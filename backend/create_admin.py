
"""Create the initial FlightGuard AI platform administrator."""

import getpass
import sqlite3
import uuid

from backend.auth import connect_db, hash_password, init_db


def main():
    init_db()

    with connect_db() as db:
        existing_admin = db.execute(
            "SELECT id FROM users WHERE is_platform_admin = 1 LIMIT 1"
        ).fetchone()

    if existing_admin:
        print("A platform administrator already exists.")
        return

    email = input("Administrator email: ").strip().lower()

    if not email or "@" not in email:
        print("Please provide a valid email address.")
        return

    password = getpass.getpass("Administrator password: ")
    confirmation = getpass.getpass("Confirm password: ")

    if password != confirmation:
        print("Passwords do not match.")
        return

    if len(password) < 12:
        print("Use a password of at least 12 characters.")
        return

    user_id = str(uuid.uuid4())

    try:
        with connect_db() as db:
            db.execute(
                """
                INSERT INTO users
                (id, email, password_hash, is_active, is_platform_admin)
                VALUES (?, ?, ?, 1, 1)
                """,
                (user_id, email, hash_password(password)),
            )
            db.execute(
                """
                INSERT INTO audit_logs (actor_user_id, action)
                VALUES (?, ?)
                """,
                (user_id, "platform_admin_created"),
            )
    except sqlite3.IntegrityError:
        print("An account with that email already exists.")
        return

    print("Platform administrator created successfully.")


if __name__ == "__main__":
    main()
