import sys
import os
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, OperationalError

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import engine

def migrate():
    with engine.connect() as conn:
        try:
            # Check if branch_id already exists
            print("Checking if branch_id exists in organization_memberships...")
            result = conn.execute(text("SHOW COLUMNS FROM organization_memberships LIKE 'branch_id'"))
            if result.fetchone():
                print("Column 'branch_id' already exists.")
            else:
                print("Column 'branch_id' does not exist. Adding it...")
                conn.execute(text("ALTER TABLE organization_memberships ADD COLUMN branch_id INTEGER NULL"))
                print("Added column 'branch_id'.")
                
                # Check for constraint
                conn.execute(text("""
                    ALTER TABLE organization_memberships 
                    ADD CONSTRAINT fk_org_mem_branch 
                    FOREIGN KEY (branch_id) REFERENCES branches(id)
                """))
                print("Added foreign key constraint 'fk_org_mem_branch'.")
            
            conn.commit()
            
            print("\nFinal Schema for organization_memberships:")
            result = conn.execute(text("DESCRIBE organization_memberships"))
            for row in result:
                print(row)
                
            print("\nForeign Keys for organization_memberships:")
            result = conn.execute(text("SHOW CREATE TABLE organization_memberships"))
            for row in result:
                print(row[1])

        except Exception as e:
            print(f"Error during migration: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate()
