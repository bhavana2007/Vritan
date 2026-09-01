import json
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User, Patient, Doctor, MedicalRecord, Prescription, PrescriptionVerification, PrescriptionMedicine
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

def create_patient_and_login(client, mobile, name):
    # Mock firebase auth token verification
    def mock_verify_token(token):
        return {"uid": f"firebase_uid_{mobile}", "phone_number": f"+91{mobile}"}
        
    import routers.auth
    routers.auth.verify_firebase_token = mock_verify_token

    # Register patient
    reg_payload = {
        "role": "patient",
        "name": name,
        "mobile": mobile,
        "firebase_id_token": f"token_{mobile}",
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
    
    # Login patient
    login_payload = {
        "firebase_id_token": f"token_{mobile}",
        "mobile": mobile
    }
    login_resp = client.post("/login/patient-firebase", json=login_payload)
    auth_data = login_resp.json()
    return auth_data["access_token"], auth_data["user"]

def create_doctor_and_login(client, mobile, name):
    # Register doctor
    reg_payload = {
        "role": "doctor",
        "name": name,
        "mobile": mobile,
        "email": f"{mobile}@vritan.com",
        "password": "Password123!",
        "specialization": "General Medicine",
        "registration_number": f"REG{mobile}",
        "hospital": "Vritan Hospital"
    }
    # Direct database insertion for test simplicity because registration of doctor requires approval
    # We will simulate registering and approval by inserting a user of role doctor
    pass

def test_prescription_qr_lifecycle_and_security(client, db_session):
    # 1. Register and login Patient A
    token_a, user_a = create_patient_and_login(client, "9876543211", "Patient A")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 2. Register and login Patient B (to test unauthorized ownership checks)
    token_b, user_b = create_patient_and_login(client, "9876543212", "Patient B")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Fetch patient ids from DB
    patient_a = db_session.query(Patient).filter(Patient.user_id == user_a["id"]).first()
    patient_b = db_session.query(Patient).filter(Patient.user_id == user_b["id"]).first()

    # Create an uploaded medical record of type prescription for Patient A
    # Scenario 1: Eligible record (no unverified medicines)
    rec_eligible = MedicalRecord(
        patient_id=patient_a.id,
        record_type="prescription",
        original_filename="rx_eligible.jpg",
        file_url="/uploads/rx_eligible.jpg",
        uploaded_by=user_a["id"],
        detected_medicines=json.dumps([
            {
                "name": "paracetamol",
                "dosage": "500 mg",
                "duration": "5 days",
                "frequency": "1-0-1",
                "requires_manual_review": False
            }
        ]),
        probable_conditions=json.dumps(["Fever"]),
        ai_structured_data=json.dumps({"doctor_or_hospital": "City Hospital", "document_type": "prescription"}),
        confidence_score=95.0,
        ai_summary="Eligible prescription with verified medicines.",
        uploaded_at=datetime.utcnow()
    )
    db_session.add(rec_eligible)
    
    # Scenario 2: Ineligible record (has medicine requiring manual review)
    rec_ineligible = MedicalRecord(
        patient_id=patient_a.id,
        record_type="prescription",
        original_filename="rx_ineligible.jpg",
        file_url="/uploads/rx_ineligible.jpg",
        uploaded_by=user_a["id"],
        detected_medicines=json.dumps([
            {
                "name": "unknown medicine X",
                "dosage": "100 mg",
                "duration": "1 week",
                "frequency": "0-0-1",
                "requires_manual_review": True
            }
        ]),
        probable_conditions=json.dumps(["Unknown Condition"]),
        ai_structured_data=json.dumps({"doctor_or_hospital": "Unknown Clinic", "document_type": "prescription"}),
        confidence_score=50.0,
        ai_summary="Ineligible prescription with unverified medicines.",
        uploaded_at=datetime.utcnow()
    )
    db_session.add(rec_ineligible)
    
    # Scenario 3: Legacy record (no QR verifications generated yet)
    rec_legacy = MedicalRecord(
        patient_id=patient_a.id,
        record_type="prescription",
        original_filename="rx_legacy.jpg",
        file_url="/uploads/rx_legacy.jpg",
        uploaded_by=user_a["id"],
        detected_medicines=json.dumps([]),
        probable_conditions=json.dumps([]),
        ai_structured_data=json.dumps({"doctor_or_hospital": "Legacy Hospital"}),
        uploaded_at=datetime.utcnow()
    )
    db_session.add(rec_legacy)
    
    db_session.commit()

    # --- Test Case 1: QR Status default (Legacy Record compatibility) ---
    get_legacy = client.get("/records/my-records", headers=headers_a)
    assert get_legacy.status_code == 200
    legacy_resp = next((r for r in get_legacy.json() if r["id"] == rec_legacy.id), None)
    assert legacy_resp is not None
    assert legacy_resp["qr_status"] == "none"
    assert legacy_resp["qr_verification_id"] is None

    # --- Test Case 2: Ineligible QR Generation fails ---
    gen_ineligible = client.post(
        "/prescriptions/verify/generate",
        headers=headers_a,
        json={"medical_record_id": rec_ineligible.id}
    )
    assert gen_ineligible.status_code == 400
    assert "requires manual review" in gen_ineligible.json()["detail"]

    # --- Test Case 3: Eligible QR Generation succeeds ---
    gen_eligible = client.post(
        "/prescriptions/verify/generate",
        headers=headers_a,
        json={"medical_record_id": rec_eligible.id}
    )
    assert gen_eligible.status_code == 200
    res_gen = gen_eligible.json()
    assert res_gen["status"] == "active"
    assert "verification_id" in res_gen
    verification_id = res_gen["verification_id"]

    # --- Test Case 4: QR Uniqueness (Repeated generation returns existing token) ---
    gen_dup = client.post(
        "/prescriptions/verify/generate",
        headers=headers_a,
        json={"medical_record_id": rec_eligible.id}
    )
    assert gen_dup.status_code == 200
    assert gen_dup.json()["verification_id"] == verification_id

    # Check status of record via list endpoint
    get_list = client.get("/records/my-records", headers=headers_a)
    rec_updated = next((r for r in get_list.json() if r["id"] == rec_eligible.id), None)
    assert rec_updated is not None
    assert rec_updated["qr_status"] == "active"
    assert rec_updated["qr_verification_id"] == verification_id

    # --- Test Case 5: Patient Ownership security (Patient B trying to generate for Patient A's record) ---
    gen_unauthorized = client.post(
        "/prescriptions/verify/generate",
        headers=headers_b,
        json={"medical_record_id": rec_eligible.id}
    )
    assert gen_unauthorized.status_code == 403

    # --- Test Case 6: QR Verification (Authorized Access) ---
    # We will simulate a pharmacist user by creating a pharmacist user in DB
    pharm_user = User(
        phone_number="+917777777777",
        role="pharmacist"
    )
    db_session.add(pharm_user)
    db_session.commit()
    
    from security import create_access_token
    pharm_token = create_access_token(user_id=pharm_user.id, role="pharmacist", email=None, mobile="+917777777777", is_verified=True)
    headers_pharm = {"Authorization": f"Bearer {pharm_token}"}

    verify_resp = client.get(f"/prescriptions/verify/{verification_id}", headers=headers_pharm)
    assert verify_resp.status_code == 200
    verification_data = verify_resp.json()
    assert verification_data["valid"] is True
    assert verification_data["status"] == "active"
    assert verification_data["prescription_reference"] == f"RX-REC-{rec_eligible.id}"
    assert len(verification_data["medicines"]) == 1
    assert verification_data["medicines"][0]["name"] == "paracetamol"

    # --- Test Case 7: Invalid/Non-existent QR verification lookup ---
    verify_invalid = client.get("/prescriptions/verify/vritan-rx-nonexistent", headers=headers_pharm)
    assert verify_invalid.status_code == 404

    # --- Test Case 8: Unauthorized Prescription Access (Patient B verifying Patient A's prescription) ---
    verify_unauthorized = client.get(f"/prescriptions/verify/{verification_id}", headers=headers_b)
    assert verify_unauthorized.status_code == 403

    # --- Test Case 9: QR Revocation ---
    revoke_resp = client.post(
        "/prescriptions/verify/revoke",
        headers=headers_a,
        json={"verification_id": verification_id}
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # Verify status of record is now updated to revoked
    get_list_revoked = client.get("/records/my-records", headers=headers_a)
    rec_revoked = next((r for r in get_list_revoked.json() if r["id"] == rec_eligible.id), None)
    assert rec_revoked is not None
    assert rec_revoked["qr_status"] == "revoked"

    # --- Test Case 10: Revoked QR verification lookup ---
    verify_revoked = client.get(f"/prescriptions/verify/{verification_id}", headers=headers_pharm)
    assert verify_revoked.status_code == 200
    assert verify_revoked.json()["valid"] is False
    assert verify_revoked.json()["status"] == "revoked"
