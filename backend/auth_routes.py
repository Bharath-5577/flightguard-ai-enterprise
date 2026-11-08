"""FlightGuard AI session authentication."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from pydantic import BaseModel

from backend.auth import connect_db, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

COOKIE_NAME = "flightguard_session"
SESSION_DAYS = 7
COOKIE_SECURE = os.getenv("FLIGHTGUARD_COOKIE_SECURE", "false").lower() == "true"

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}


class LoginRequest(BaseModel):
    email: str
    password: str
    portal: str


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_same_origin(request: Request):
    origin = request.headers.get("origin")
    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Invalid request origin.")


def get_session_user(token: str | None):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    with connect_db() as db:
        user = db.execute(
            """
            SELECT u.id, u.email, u.is_platform_admin,
                   u.is_active, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (hash_token(token),),
        ).fetchone()

        if not user or not user["is_active"]:
            raise HTTPException(status_code=401, detail="Invalid session.")

        expiry = datetime.fromisoformat(user["expires_at"])
        if expiry <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired.")

        memberships = db.execute(
            """
            SELECT m.organization_id, m.role, o.name
            FROM memberships m
            JOIN organizations o ON o.id = m.organization_id
            WHERE m.user_id = ? AND o.status = 'active'
            """,
            (user["id"],),
        ).fetchall()

    return {
        "id": user["id"],
        "email": user["email"],
        "is_platform_admin": bool(user["is_platform_admin"]),
        "organizations": [dict(row) for row in memberships],
    }


@router.post("/login")
def login(data: LoginRequest, request: Request, response: Response):
    require_same_origin(request)

    if data.portal not in ("admin", "airline"):
        raise HTTPException(status_code=422, detail="Invalid portal.")

    email = data.email.strip().lower()

    with connect_db() as db:
        user = db.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    # Do not reveal whether an email address exists.
    if not user or not verify_password(
        data.password, user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account inactive.")

    is_admin = bool(user["is_platform_admin"])

    if data.portal == "admin" and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied.")

    if data.portal == "airline" and is_admin:
        raise HTTPException(status_code=403, detail="Use the admin portal.")

    if data.portal == "airline":
        with connect_db() as db:
            membership = db.execute(
                """
                SELECT 1
                FROM memberships m
                JOIN organizations o ON o.id = m.organization_id
                WHERE m.user_id = ? AND o.status = 'active'
                LIMIT 1
                """,
                (user["id"],),
            ).fetchone()

        if not membership:
            raise HTTPException(
                status_code=403,
                detail="No active airline membership.",
            )

    token = secrets.token_urlsafe(48)
    expiry = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)

    with connect_db() as db:
        db.execute(
            """
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (?, ?, ?)
            """,
            (hash_token(token), user["id"], expiry.isoformat()),
        )
        db.execute(
            "INSERT INTO audit_logs (actor_user_id, action) VALUES (?, ?)",
            (user["id"], "login"),
        )

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_DAYS * 86400,
        path="/",
    )

    return {
        "status": "success",
        "portal": data.portal,
        "redirect": "/admin" if is_admin else "/airline/dashboard",
    }


@router.get("/me")
def current_user(
    flightguard_session: str | None = Cookie(default=None),
):
    return get_session_user(flightguard_session)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    flightguard_session: str | None = Cookie(default=None),
):
    require_same_origin(request)

    if flightguard_session:
        with connect_db() as db:
            db.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (hash_token(flightguard_session),),
            )

    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "success"}
