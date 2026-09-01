import os
import sys
from sqlalchemy import create_engine, text

backend_dir = r"d:\Vritan\backend"
sys.path.append(backend_dir)

from database import DATABASE_URL

def run_migrations():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        print("Starting migrations...")
        
        # 1. Modify appointments table foreign key
        try:
            conn.execute(text("ALTER TABLE appointments DROP FOREIGN KEY appointments_ibfk_3;"))
            print("Dropped appointments_ibfk_3 foreign key constraint.")
        except Exception as e:
            print(f"Could not drop appointments_ibfk_3 (it may not exist or has a different name): {e}")

        try:
            conn.execute(text("ALTER TABLE appointments ADD CONSTRAINT appointments_ibfk_3 FOREIGN KEY (hospital_branch_id) REFERENCES branches (id);"))
            print("Added appointments_ibfk_3 referencing branches (id).")
        except Exception as e:
            print(f"Error adding appointments_ibfk_3 constraint: {e}")
            
        # 2. Modify appointment_slots table foreign key
        try:
            conn.execute(text("ALTER TABLE appointment_slots DROP FOREIGN KEY appointment_slots_ibfk_2;"))
            print("Dropped appointment_slots_ibfk_2 foreign key constraint.")
        except Exception as e:
            print(f"Could not drop appointment_slots_ibfk_2: {e}")

        try:
            conn.execute(text("ALTER TABLE appointment_slots ADD CONSTRAINT appointment_slots_ibfk_2 FOREIGN KEY (branch_id) REFERENCES branches (id);"))
            print("Added appointment_slots_ibfk_2 referencing branches (id).")
        except Exception as e:
            print(f"Error adding appointment_slots_ibfk_2 constraint: {e}")

        print("Migrations finished successfully.")

if __name__ == "__main__":
    run_migrations()
