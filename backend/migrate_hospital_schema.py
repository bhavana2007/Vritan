from database import engine
from sqlalchemy import text

def run():
    with engine.begin() as conn:
        print("Starting Phase 8 Database Migration...")
        
        try:
            conn.execute(text("ALTER TABLE appointments RENAME COLUMN hospital_branch_id TO branch_id"))
            print("Successfully renamed appointments.hospital_branch_id to branch_id")
        except Exception as e:
            print(f"Error renaming column in appointments: {e}")
            
            try:
                print("Trying CHANGE COLUMN instead...")
                # Try CHANGE COLUMN instead
                conn.execute(text("ALTER TABLE appointments CHANGE hospital_branch_id branch_id INTEGER"))
                print("Successfully changed appointments.hospital_branch_id to branch_id")
            except Exception as e2:
                print(f"Error using CHANGE COLUMN: {e2}")

        
        try:
            res = conn.execute(text("""
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = 'departments' 
                AND COLUMN_NAME = 'hospital_branch_id' 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            """))
            fk_name = res.scalar()
            if fk_name:
                conn.execute(text(f"ALTER TABLE departments DROP FOREIGN KEY {fk_name}"))
                print(f"Dropped foreign key {fk_name} from departments.")
            
            conn.execute(text("ALTER TABLE departments DROP COLUMN hospital_branch_id"))
            print("Successfully dropped hospital_branch_id from departments")
        except Exception as e:
            print(f"Error altering departments: {e}")

if __name__ == '__main__':
    run()
