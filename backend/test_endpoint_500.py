import json
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User

client = TestClient(app)
db = SessionLocal()

# Find Hansika's user
hansika = db.query(User).filter(User.id == 294).first()
print(f"User 294: {hansika}, role: {hansika.role}")

from fastapi.testclient import TestClient
from main import app
from security import create_access_token

client = TestClient(app, raise_server_exceptions=True)

try:
    token = create_access_token(user_id=hansika.id, role=hansika.role, email=hansika.email, mobile=hansika.phone_number, is_verified=True)
    response = client.get(
        "/api/v1/appointments/my-appointments",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(response.status_code)
    print(response.json())
except Exception as e:
    import traceback
    traceback.print_exc()

db.close()
