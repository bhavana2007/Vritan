from database import engine
from sqlalchemy import text

def run():
    with engine.begin() as conn:
        print("Renaming legacy tables...")
        try:
            conn.execute(text("RENAME TABLE hospitals TO legacy_hospitals_backup"))
            print("Successfully renamed hospitals to legacy_hospitals_backup")
        except Exception as e:
            print(f"Error renaming hospitals: {e}")
            
        try:
            conn.execute(text("RENAME TABLE hospital_branches TO legacy_hospital_branches_backup"))
            print("Successfully renamed hospital_branches to legacy_hospital_branches_backup")
        except Exception as e:
            print(f"Error renaming hospital_branches: {e}")

if __name__ == '__main__':
    run()
