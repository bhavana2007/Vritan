import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("DESCRIBE organization_memberships:")
    result = conn.execute(text("DESCRIBE organization_memberships"))
    for row in result:
        print(row)
