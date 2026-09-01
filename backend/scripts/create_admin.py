"""Create or update a local Vritan admin account."""
import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from database import SessionLocal, engine
from models import Admin, Base
from security import hash_password

DEFAULT_EMAIL = "admin@medilocker.com"
DEFAULT_PASSWORD = "Admin@123"


def create_admin(email: str, password: str) -> None:
    normalized_email = email.strip().lower()
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = db.query(Admin).filter(Admin.email == normalized_email).first()
        password_hash = hash_password(password)
        if admin:
            admin.password = password_hash
            admin.is_active = True
            action = "Updated"
        else:
            db.add(
                Admin(
                    email=normalized_email,
                    password=password_hash,
                    is_active=True,
                )
            )
            action = "Created"
        db.commit()
        print(f"{action} admin account: {normalized_email}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Vritan admin account.")
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    args = parser.parse_args()
    create_admin(args.email, args.password)


if __name__ == "__main__":
    main()
