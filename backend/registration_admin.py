"""Administrator-only airline registration management."""

import sqlite3
import uuid

from fastapi import APIRouter, Cookie, HTTPException, Request
from pydantic import BaseModel

from backend.auth import connect_db
from backend.auth_routes import ALLOWED_ORIGINS, get_session_user

router = APIRouter(
    prefix="/api/admin/registrations",
    tags=["Registration Management"],
)

LOCAL_HOSTS = {"localhost", "127.0.0.1"}
LOCAL_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}


def require_admin(request: Request, token: str | None):
    origin = request.headers.get("origin")

    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(403, "Invalid origin.")

    if origin in LOCAL_ORIGINS:
        if request.client is None or request.client.host not in LOCAL_HOSTS:
            raise HTTPException(403, "Local access only.")
    else:
        if request.url.scheme != "https":
            raise HTTPException(403, "HTTPS required.")

    user = get_session_user(token)

    if not user["is_platform_admin"]:
        raise HTTPException(403, "Administrator access required.")

    return user


@router.get("")
def list_registrations(
    request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    require_admin(request, flightguard_session)

    with connect_db() as db:
        rows = db.execute("""
            SELECT id, full_name, organization_name,
                   email, status, created_at
            FROM registration_requests
            ORDER BY created_at DESC
        """).fetchall()

    return [dict(row) for row in rows]


class StatusUpdate(BaseModel):
    status: str


def activate_registration(db, registration, admin_id):
    """Create the organization, user and membership atomically."""

    existing = db.execute(
        "SELECT id FROM users WHERE email = ?",
        (registration["email"],),
    ).fetchone()

    if existing:
        raise HTTPException(
            409,
            "An account already exists for this email.",
        )

    organization_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    db.execute(
        """
        INSERT INTO organizations (id, name, status)
        VALUES (?, ?, 'active')
        """,
        (organization_id, registration["organization_name"]),
    )

    db.execute(
        """
        INSERT INTO users
        (id, email, password_hash, is_active, is_platform_admin)
        VALUES (?, ?, ?, 1, 0)
        """,
        (
            user_id,
            registration["email"],
            registration["password_hash"],
        ),
    )

    db.execute(
        """
        INSERT INTO memberships
        (user_id, organization_id, role)
        VALUES (?, ?, 'org_admin')
        """,
        (user_id, organization_id),
    )

    db.execute(
        """
        INSERT INTO audit_logs
        (actor_user_id, organization_id, action)
        VALUES (?, ?, ?)
        """,
        (
            admin_id,
            organization_id,
            "airline_registration_approved",
        ),
    )


@router.patch("/{registration_id}")
def update_registration(
    registration_id: str,
    data: StatusUpdate,
    request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    admin = require_admin(request, flightguard_session)

    if data.status not in {"approved", "rejected"}:
        raise HTTPException(422, "Invalid registration status.")

    try:
        with connect_db() as db:
            db.execute("BEGIN IMMEDIATE")

            registration = db.execute(
                """
                SELECT *
                FROM registration_requests
                WHERE id = ? AND status = 'pending'
                """,
                (registration_id,),
            ).fetchone()

            if not registration:
                raise HTTPException(
                    404,
                    "Pending registration not found.",
                )

            if data.status == "approved":
                activate_registration(
                    db, registration, admin["id"]
                )
            else:
                db.execute(
                    """
                    INSERT INTO audit_logs
                    (actor_user_id, action)
                    VALUES (?, ?)
                    """,
                    (
                        admin["id"],
                        "airline_registration_rejected",
                    ),
                )

            db.execute(
                """
                UPDATE registration_requests
                SET status = ?
                WHERE id = ?
                """,
                (data.status, registration_id),
            )

    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            409,
            "Registration activation failed due to an account conflict.",
        ) from exc

    return {"status": data.status}


@router.get("/overview")
def admin_overview(
    request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    """Authenticated platform overview based on real database records."""
    require_admin(request, flightguard_session)

    with connect_db() as db:
        organizations = db.execute(
            "SELECT COUNT(*) FROM organizations"
        ).fetchone()[0]

        active_organizations = db.execute(
            "SELECT COUNT(*) FROM organizations WHERE status = 'active'"
        ).fetchone()[0]

        airline_users = db.execute(
            "SELECT COUNT(*) FROM users WHERE is_platform_admin = 0"
        ).fetchone()[0]

        pending = db.execute(
            "SELECT COUNT(*) FROM registration_requests WHERE status = 'pending'"
        ).fetchone()[0]

        approved = db.execute(
            "SELECT COUNT(*) FROM registration_requests WHERE status = 'approved'"
        ).fetchone()[0]

        rejected = db.execute(
            "SELECT COUNT(*) FROM registration_requests WHERE status = 'rejected'"
        ).fetchone()[0]

        recent_activity = db.execute(
            """
            SELECT action, created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 8
            """
        ).fetchall()

    return {
        "status": "success",
        "organizations": organizations,
        "active_organizations": active_organizations,
        "airline_users": airline_users,
        "registrations": {
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
        },
        "recent_activity": [dict(row) for row in recent_activity],
    }
