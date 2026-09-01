import io
import json
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User, Patient, MedicalRecord
import routers.auth

# Use SQLite memory DB for testing
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

def test_upload_medical_record_end_to_end(client, db_session, monkeypatch):
    # Mock firebase token verification
    mock_uid = "firebase_uid_upload_test"
    mock_phone = "+919876543211"
    
    def mock_verify_token(token):
        return {"uid": mock_uid, "phone_number": mock_phone}
        
    monkeypatch.setattr(routers.auth, "verify_firebase_token", mock_verify_token)
    
    # 1. Register patient
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
    reg_resp = client.post("/register", json=reg_payload)
    assert reg_resp.status_code == 200, reg_resp.text
    
    # 2. Login patient to get token
    login_payload = {
        "firebase_id_token": "valid_token_upload_123",
        "mobile": "9876543211"
    }
    login_resp = client.post("/login/patient-firebase", json=login_payload)
    assert login_resp.status_code == 200, login_resp.text
    auth_data = login_resp.json()
    access_token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 3. Mock OCR/AI Services to return rich modern medicine structure
    mock_compress = MagicMock(side_effect=lambda path: path)
    mock_ocr = MagicMock(return_value="Amphotericin B 300mg IV OD for 2 weeks")
    
    mock_gemini_result = {
        "cleaned_text": "Amphotericin B 300mg IV OD for 2 weeks",
        "medicines": [
            {
                "name": "amphotericin B",
                "dosage": "300 mg",
                "duration": "2 weeks",
                "frequency": "IV OD",
                "food_instructions": None,
                "instructions": "Alternative option 1",
                "confidence": 100,
                "validation_reason": "database_exact",
                "match_type": "exact",
                "formulation_metadata": ["Inj", "Liposomal"],
                "generic_name": "amphotericin B",
                "brand_name": "",
                "route": "",
                # Add modern / future additive metadata to test preservation
                "requires_manual_review": False,
                "suspicious_reason": "none",
                "future_validation_metadata": {"custom_score": 9.5}
            }
        ],
        "possible_conditions": ["Infection"],
        "confidence_score": 100,
        "ai_summary": "Inference with 100% confidence",
        "doctor_or_hospital": "Test Hospital",
        "document_type": "prescription",
        "classification_confidence": 95.0,
        "classification_reason": "Matches prescription template",
        "ocr_quality_score": 98.0,
        "processing_time": 1.2,
        "schema_validation_passed": True,
        "validation_errors": "",
        "rejected": False,
        "rejection_reason": ""
    }
    mock_gemini = MagicMock(return_value=mock_gemini_result)

    monkeypatch.setattr(routers.auth, "compress_image", mock_compress)
    monkeypatch.setattr(routers.auth, "extract_text_from_file", mock_ocr)
    monkeypatch.setattr(routers.auth, "structure_medical_text", mock_gemini)

    # 4. Perform POST /records/upload
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
    
    assert response.status_code == 200, response.text
    record_resp = response.json()
    
    # 5. Verify the response contains the complete medicine object and properties
    assert record_resp["record_type"] == "prescription"
    assert len(record_resp["detected_medicines"]) == 1
    
    med = record_resp["detected_medicines"][0]
    assert med["name"] == "amphotericin B"
    assert med["dosage"] == "300 mg"
    assert med["duration"] == "2 weeks"
    assert med["frequency"] == "IV OD"
    assert med["food_instructions"] is None
    assert med["instructions"] == "Alternative option 1"
    assert med["confidence"] == 100.0
    assert med["validation_reason"] == "database_exact"
    assert med["match_type"] == "exact"
    assert med["formulation_metadata"] == ["Inj", "Liposomal"]
    assert med["generic_name"] == "amphotericin B"
    assert med["brand_name"] == ""
    assert med["route"] == ""
    
    # Verify extra fields survive
    assert med["requires_manual_review"] is False
    assert med["suspicious_reason"] == "none"
    assert med["future_validation_metadata"] == {"custom_score": 9.5}

    # 6. Verify GET /records/my-records returns the record successfully without Pydantic validation errors
    get_resp = client.get("/records/my-records", headers=headers)
    assert get_resp.status_code == 200, get_resp.text
    
    records_list = get_resp.json()
    assert len(records_list) >= 1
    
    # Find our record
    uploaded_record = next((r for r in records_list if r["id"] == record_resp["id"]), None)
    assert uploaded_record is not None
    assert uploaded_record["original_filename"] == record_resp["original_filename"]
    assert len(uploaded_record["detected_medicines"]) == 1
    
    med_recovered = uploaded_record["detected_medicines"][0]
    assert med_recovered["name"] == "amphotericin B"
    assert med_recovered["confidence"] == 100.0
    assert med_recovered["formulation_metadata"] == ["Inj", "Liposomal"]
    assert med_recovered["requires_manual_review"] is False
    assert med_recovered["suspicious_reason"] == "none"
    assert med_recovered["future_validation_metadata"] == {"custom_score": 9.5}
