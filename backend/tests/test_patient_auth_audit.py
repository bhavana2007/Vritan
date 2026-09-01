import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User, Patient
import routers.auth

# Use a clean SQLite memory database with StaticPool to keep the connection alive
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)

@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_patient_registration_and_duplicate_flow(client, monkeypatch):
    # Mock firebase token verification
    mock_uid = "firebase_uid_test_123"
    mock_phone = "+919876543210"
    
    def mock_verify_token(token):
        return {"uid": mock_uid, "phone_number": mock_phone}
        
    monkeypatch.setattr(routers.auth, "verify_firebase_token", mock_verify_token)
    
    # 1. Register patient (empty DB)
    payload = {
        "role": "patient",
        "name": "Test Patient One",
        "mobile": "9876543210",
        "firebase_id_token": "valid_token_123",
        "date_of_birth": "1995-01-01",
        "gender": "Male",
        "blood_group": "O+",
        "pin_code": "500001",
        "country": "India",
        "state": "Telangana",
        "district": "Hyderabad",
        "mandal": "Mandal",
        "city": "Hyderabad",
        "consent_status": True,
        "consent_terms": True,
        "consent_privacy": True,
        "consent_medical_storage": True,
        "consent_analytics": True
    }
    
    response = client.post("/register", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["message"] == "patient registered successfully"
    
    # 2. Register duplicate patient (should return 409 Conflict)
    payload_duplicate = payload.copy()
    payload_duplicate["name"] = "Duplicate Patient"
    
    response_dup = client.post("/register", json=payload_duplicate)
    assert response_dup.status_code == 409
    assert response_dup.json()["detail"] == "This mobile number is already registered"

def test_patient_login_flow(client, monkeypatch):
    mock_uid = "firebase_uid_login_999"
    mock_phone = "+919999999999"
    
    def mock_verify_token(token):
        return {"uid": mock_uid, "phone_number": mock_phone}
        
    monkeypatch.setattr(routers.auth, "verify_firebase_token", mock_verify_token)
    
    # 1. Login with unknown account (should return 404 NO_ACCOUNT)
    login_payload = {
        "firebase_id_token": "unknown_token",
        "mobile": "9999999999"
    }
    response = client.post("/login/patient-firebase", json=login_payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "NO_ACCOUNT"
    
    # 2. Register the account
    reg_payload = {
        "role": "patient",
        "name": "Login Test Patient",
        "mobile": "9999999999",
        "firebase_id_token": "unknown_token",
        "date_of_birth": "1995-01-01",
        "gender": "Female",
        "consent_status": True,
        "consent_terms": True,
        "consent_privacy": True,
        "consent_medical_storage": True,
        "consent_analytics": True
    }
    reg_resp = client.post("/register", json=reg_payload)
    assert reg_resp.status_code == 200
    
    # 3. Try login again (should succeed 200)
    response_success = client.post("/login/patient-firebase", json=login_payload)
    assert response_success.status_code == 200
    assert "access_token" in response_success.json()
