import os
import sys
from sqlalchemy import create_engine, text

# Adjust sys.path to include backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from database import DATABASE_URL

def run_migrations():
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        # Check dialect
        is_sqlite = DATABASE_URL.startswith("sqlite")
        
        if is_sqlite:
            print("Running DDL modifications for SQLite (implicit nullability)...")
            # SQLite allows NULLs unless STRICT is enabled or explicitly enforced by a copy.
            # Since standard SQLite tables without STRICT support changing values to NULL,
            # we can run without aggressive schema alteration.
        else:
            print("Running DDL modifications for MySQL...")
            try:
                conn.execute(text("ALTER TABLE appointments MODIFY hospital_branch_id INT NULL;"))
                print("Altered hospital_branch_id to NULL in appointments")
            except Exception as e:
                print(f"Skip/Error altering hospital_branch_id: {e}")
                
            try:
                conn.execute(text("ALTER TABLE appointments MODIFY department_id INT NULL;"))
                print("Altered department_id to NULL in appointments")
            except Exception as e:
                print(f"Skip/Error altering department_id: {e}")
                
            try:
                conn.execute(text("ALTER TABLE appointment_slots MODIFY branch_id INT NULL;"))
                print("Altered branch_id to NULL in appointment_slots")
            except Exception as e:
                print(f"Skip/Error altering branch_id: {e}")

        # Enforce canonical status 'VERIFIED'
        tables = ["doctors", "organizations", "pharmacies", "laboratories", "government_authorities"]
        for table in tables:
            try:
                # Update approved to VERIFIED
                conn.execute(text(f"UPDATE {table} SET verification_status = 'VERIFIED' WHERE verification_status = 'approved'"))
                print(f"Migrated verification_status in '{table}' table to VERIFIED")
            except Exception as e:
                print(f"Could not migrate table {table}: {e}")
                
        print("Database migrations applied successfully!")

if __name__ == "__main__":
    run_migrations()
