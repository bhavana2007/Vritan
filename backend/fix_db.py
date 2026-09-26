import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from database import engine
from sqlalchemy import text

def add_columns():
    with engine.connect() as conn:
        try:
            # We'll drop the table and recreate it since invitations are transient
            conn.execute(text("DROP TABLE IF EXISTS organization_invitations"))
            print("Dropped organization_invitations")
            
            # What about organization_employee_assignments?
            # conn.execute(text("DROP TABLE IF EXISTS organization_employee_assignments"))
            # print("Dropped organization_employee_assignments")
        except Exception as e:
            print(f"Error dropping table: {e}")
            
        conn.commit()

if __name__ == "__main__":
    add_columns()
    
    # recreate missing tables
    import models
    from database import Base
    Base.metadata.create_all(bind=engine)
    print("Recreated missing tables.")
