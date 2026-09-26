import os
import sys

from sqlalchemy import text
from database import engine
from org_models import Base

def apply_changes():
    print("Applying schema changes...")
    
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE branches ADD COLUMN admin_name VARCHAR(255) NULL;"))
            print("Added admin_name to branches.")
        except Exception as e:
            print(f"Skipped admin_name: {e}")
            
        try:
            conn.execute(text("ALTER TABLE branches ADD COLUMN admin_email VARCHAR(255) NULL;"))
            print("Added admin_email to branches.")
        except Exception as e:
            print(f"Skipped admin_email: {e}")
            
        try:
            conn.execute(text("ALTER TABLE branches ADD COLUMN admin_mobile VARCHAR(50) NULL;"))
            print("Added admin_mobile to branches.")
        except Exception as e:
            print(f"Skipped admin_mobile: {e}")

    # Create new tables (like doctor_transfer_requests)
    Base.metadata.create_all(bind=engine)
    print("New tables created successfully.")

if __name__ == "__main__":
    apply_changes()
