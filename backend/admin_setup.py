"""One-time platform administrator setup."""

import hmac
import os
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.auth import connect_db, hash_password, init_db

router = APIRouter(prefix="/api/admin/setup", tags=["Admin Setup"])

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}


class AdminSetupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)
    setup_code: str


@router.get("/status")
def setup_status():
    init_db()

    with connect_db() as db:
        exists = db.execute(
            "SELECT 1 FROM users WHERE is_platform_admin = 1 LIMIT 1"
        ).fetchone()

    return {"setup_available": exists is None}


@router.post("/create", status_code=201)
def create_initial_admin(data: AdminSetupRequest, request: Request):
    if request.headers.get("origin") not in ALLOWED_ORIGINS:
        raise HTTPException(403, "Invalid request origin.")

    expected_code = os.environ.get("FLIGHTGUARD_ADMIN_SETUP_CODE", "")

    if not expected_code or not hmac.compare_digest(
        data.setup_code.encode(),
        expected_code.encode(),
    ):
        raise HTTPException(403, "Invalid setup code.")

    email = data.email.strip().lower()

    if not email or "@" not in email:
        raise HTTPException(422, "Invalid email address.")

    init_db()

    with connect_db() as db:
        existing = db.execute(
            "SELECT 1 FROM users WHERE is_platform_admin = 1 LIMIT 1"
        ).fetchone()

        if existing:
            raise HTTPException(409, "Administrator setup is closed.")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(data.password)

    try:
        # IMMEDIATE transaction prevents simultaneous first-admin creation.
        with connect_db() as db:
            db.execute("BEGIN IMMEDIATE")

            existing = db.execute(
                "SELECT 1 FROM users WHERE is_platform_admin = 1 LIMIT 1"
            ).fetchone()

            if existing:
                raise HTTPException(409, "Administrator setup is closed.")

            db.execute(
                """
                INSERT INTO users
                (id, email, password_hash, is_active, is_platform_admin)
                VALUES (?, ?, ?, 1, 1)
                """,
                (user_id, email, password_hash),
            )

            db.execute(
                """
                INSERT INTO audit_logs (actor_user_id, action)
                VALUES (?, ?)
                """,
                (user_id, "initial_admin_created"),
            )

    except sqlite3.IntegrityError:
        raise HTTPException(409, "This email is already registered.")

    return {
        "status": "success",
        "message": "Administrator created successfully. Please sign in.",
    }
