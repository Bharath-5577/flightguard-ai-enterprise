
"""FlightGuard AI authentication database foundation."""

import os
import sqlite3
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

DB_PATH = Path(
    os.environ.get(
        "FLIGHTGUARD_AUTH_DB",
        str(Path(__file__).resolve().parent / "flightguard_auth.db"),
    )
)

password_hasher = PasswordHasher()


def connect_db():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connect_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_platform_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memberships (
                user_id TEXT NOT NULL,
                organization_id TEXT NOT NULL,
                role TEXT NOT NULL
                    CHECK (role IN ('org_admin', 'analyst')),
                PRIMARY KEY (user_id, organization_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id TEXT,
                organization_id TEXT,
                action TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return password_hasher.verify(stored_hash, password)
    except VerificationError:
        return False


def init_registration_tables():
    """Create the table for new customer signup requests."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connect_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS registration_requests (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                organization_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        status IN ('pending', 'approved', 'rejected')
                    ),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
