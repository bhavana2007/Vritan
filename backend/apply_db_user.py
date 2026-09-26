import os
import sys

from sqlalchemy import text
from database import engine

def apply_changes():
    print("Applying schema changes...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN vritan_id VARCHAR(50) NULL UNIQUE;"))
            print("Added vritan_id to users.")
        except Exception as e:
            print(f"Skipped vritan_id: {e}")

if __name__ == "__main__":
    apply_changes()
