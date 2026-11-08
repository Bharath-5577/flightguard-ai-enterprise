import getpass
import sqlite3
import uuid

from backend.auth import connect_db, hash_password, init_db

def main():
    init_db()

    with connect_db() as db:
        count = db.execute(
            "SELECT COUNT(*) FROM users WHERE is_platform_admin = 1"
        ).fetchone()[0]

    if count:
        print("An administrator already exists. Bootstrap disabled.")
        return

    email = input("Administrator email: ").strip().lower()

    if not email or "@" not in email:
        print("Invalid email address.")
        return

    password = getpass.getpass("Create password (12+ characters): ")
    confirm = getpass.getpass("Confirm password: ")

    if len(password) < 12:
        print("Password must contain at least 12 characters.")
        return

    if password != confirm:
        print("Passwords do not match.")
        return

    with connect_db() as db:
        try:
            db.execute(
                """
                INSERT INTO users
                (id, email, password_hash, is_active, is_platform_admin)
                VALUES (?, ?, ?, 1, 1)
                """,
                (str(uuid.uuid4()), email, hash_password(password)),
            )
        except sqlite3.IntegrityError:
            print("Email already exists.")
            return

    print("Administrator account created successfully.")

if __name__ == "__main__":
    main()
