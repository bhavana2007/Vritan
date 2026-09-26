import json
import asyncio
from fastapi.testclient import TestClient
from main import app
from database import Base, get_db
import routers.auth
from unittest.mock import MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Mocking DB and Firebase
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)
db_session = TestingSessionLocal()

def override_get_db():
    yield db_session

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

mock_uid = "firebase_uid_upload_test"
mock_phone = "+919876543211"
def mock_verify_token(token):
    return {"uid": mock_uid, "phone_number": mock_phone}

import routers.auth
routers.auth.verify_firebase_token = mock_verify_token

# Register and login
reg_payload = {
    "role": "patient",
    "name": "Integration Test Patient",
    "mobile": "9876543211",
    "firebase_id_token": "valid_token_upload_123",
    "date_of_birth": "1990-05-15",
    "gender": "Male",
    "blood_group": "A+",
    "pin_code": "560001",
    "country": "India",
    "state": "Karnataka",
    "district": "Bangalore",
    "mandal": "Bangalore",
    "city": "Bangalore",
    "consent_status": True,
    "consent_terms": True,
    "consent_privacy": True,
    "consent_medical_storage": True,
    "consent_analytics": True
}
client.post("/register", json=reg_payload)
login_payload = {
    "firebase_id_token": "valid_token_upload_123",
    "mobile": "9876543211"
}
login_resp = client.post("/login/patient-firebase", json=login_payload)
access_token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {access_token}"}

sample_ocr = "RIVERSIDE MEDICAL CENTRE 824 11 Stret Niew lort, NY91743, USA NAME JOLA SMith ADRESS 162 Example St. N7 R AGE 34 DATE: 09-11-12 Betaloc 100 mg -1 tab BID Dorzolanizum 10 mg-l tab BSD Cinetizine 50 mg- 2 tass TD Oxprelol SOmg- 1 tab QD De. Stave Johnson sigaaturo GLABEL REFLL 002 3 4 5 PRN"

def mock_ocr(path):
    return sample_ocr

def mock_compress(path):
    return path

routers.auth.compress_image = mock_compress
routers.auth.extract_text_from_file = mock_ocr

# Let gemini service actually run with real API!
# We don't mock structure_medical_text here.

import io
fake_file = io.BytesIO(b"dummy pdf contents")
upload_data = {
    "record_type": "prescription",
    "notes": "My first prescription upload"
}

response = client.post(
    "/records/upload",
    headers=headers,
    data=upload_data,
    files={"file": ("prescription.pdf", fake_file, "application/pdf")}
)

print(json.dumps(response.json(), indent=2))
