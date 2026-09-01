import json
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import User, Patient, Doctor, MedicalRecord, Prescription, PrescriptionMedicine
from routers.auth import _medical_record_public, _resolve_record_title_and_condition

# Setup a clean in-memory test database for these metadata/search tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_metadata_search.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Create a Patient User
    patient_user = User(
        email="patient_search@vritan.com",
        role="patient"
    )
    db.add(patient_user)
    db.commit()
    db.refresh(patient_user)
    
    patient = Patient(
        user_id=patient_user.id,
        full_name="Bhavana Dev",
        email="patient_search@vritan.com",
        consent_status=True
    )
    db.add(patient)
    
    # 2. Create a Doctor User
    doctor_user = User(
        email="doctor_search@vritan.com",
        role="doctor"
    )
    db.add(doctor_user)
    db.commit()
    db.refresh(doctor_user)
    
    doctor = Doctor(
        user_id=doctor_user.id,
        full_name="Dr. Sampurna Ghosh",
        email="doctor_search@vritan.com",
        hospital="OPD Sunshine Gachibowli"
    )
    db.add(doctor)
    db.commit()

    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_prescription_title_persistence_and_normalization():
    db = TestingSessionLocal()
    patient = db.query(Patient).filter(Patient.full_name == "Bhavana Dev").first()
    
    # Test case: Storing clean persisted title, condition, and status during processing simulation
    final_conditions = ["Bilateral Profound Hearing Loss"]
    confidence_score = 90.0
    ai_summary = "Inferred hearing loss prescription"
    doctor_or_hospital = "Dr. Sampurna Ghosh - OPD Sunshine Gachibowli"
    
    # Extract distinct doctor and hospital
    doc_name = doctor_or_hospital.split(" - ")[0].strip()
    hosp_name = doctor_or_hospital.split(" - ")[1].strip()
    
    assert doc_name == "Dr. Sampurna Ghosh"
    assert hosp_name == "OPD Sunshine Gachibowli"
    
    ai_structured_data = {
        "possible_conditions": final_conditions,
        "confidence": confidence_score,
        "summary": ai_summary,
        "doctor_or_hospital": doctor_or_hospital,
        "doctor_name": doc_name,
        "hospital": hosp_name,
        "document_title": "Prescription — Bilateral Profound Hearing Loss",
    }
    
    record = MedicalRecord(
        patient_id=patient.id,
        record_type="prescription",
        file_url="/uploads/test_file.jpg",
        original_filename="test_file.jpg",
        uploaded_by=patient.user_id,
        probable_conditions=json.dumps(final_conditions),
        ai_structured_data=json.dumps(ai_structured_data),
        confidence_score=confidence_score,
        document_title="Prescription — Bilateral Profound Hearing Loss",
        condition="Bilateral Profound Hearing Loss",
        condition_status="probable"
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    # Assert persistence
    assert record.document_title == "Prescription — Bilateral Profound Hearing Loss"
    assert record.condition == "Bilateral Profound Hearing Loss"
    assert record.condition_status == "probable"
    
    # Assert public schema mapping
    pub = _medical_record_public(record)
    assert pub.document_title == "Prescription — Bilateral Profound Hearing Loss"
    assert pub.condition == "Bilateral Profound Hearing Loss"
    assert pub.condition_status == "probable"
    assert pub.display_title == "Prescription — Bilateral Profound Hearing Loss"
    
    db.close()


def test_legacy_record_fallback_title():
    db = TestingSessionLocal()
    patient = db.query(Patient).filter(Patient.full_name == "Bhavana Dev").first()
    
    # Case 1: Legacy record where document_title columns are NULL, has condition
    legacy_rec = MedicalRecord(
        patient_id=patient.id,
        record_type="prescription",
        file_url="/uploads/legacy1.jpg",
        original_filename="legacy1.jpg",
        uploaded_by=patient.user_id,
        probable_conditions=json.dumps(["Possible related condition: Profound Hearing Loss"]),
        ai_structured_data=json.dumps({
            "doctor_or_hospital": "Dr. Sampurna Ghosh - OPD Sunshine Gachibowli",
        })
    )
    db.add(legacy_rec)
    db.commit()
    
    title, cond, status = _resolve_record_title_and_condition(legacy_rec)
    assert title == "Prescription — Profound Hearing Loss"
    assert cond == "Profound Hearing Loss"
    assert status == "probable"
    
    # Case 2: Legacy record, diagnosis is empty, falls back to doctor name
    legacy_rec2 = MedicalRecord(
        patient_id=patient.id,
        record_type="prescription",
        file_url="/uploads/legacy2.jpg",
        original_filename="legacy2.jpg",
        uploaded_by=patient.user_id,
        probable_conditions=json.dumps([]),
        ai_structured_data=json.dumps({
            "doctor_or_hospital": "Dr. Sampurna Ghosh - OPD Sunshine Gachibowli",
        })
    )
    db.add(legacy_rec2)
    db.commit()
    
    title2, cond2, status2 = _resolve_record_title_and_condition(legacy_rec2)
    assert title2 == "Prescription — Dr. Sampurna Ghosh"
    
    db.close()


def test_case_insensitive_partial_search():
    db = TestingSessionLocal()
    patient = db.query(Patient).filter(Patient.full_name == "Bhavana Dev").first()
    
    # Add a record to search
    rec = MedicalRecord(
        patient_id=patient.id,
        record_type="prescription",
        file_url="/uploads/search_test.jpg",
        original_filename="search_test.jpg",
        uploaded_by=patient.user_id,
        detected_medicines=json.dumps([{"name": "Amphotericin B", "dosage": "300mg"}]),
        probable_conditions=json.dumps(["Hearing Loss"]),
        ai_structured_data=json.dumps({
            "doctor_or_hospital": "Dr. Sampurna Ghosh - OPD Sunshine Gachibowli",
            "doctor_name": "Dr. Sampurna Ghosh",
            "hospital": "OPD Sunshine Gachibowli"
        }),
        document_title="Prescription — Bilateral Profound Hearing Loss",
        condition="Bilateral Profound Hearing Loss",
        condition_status="probable"
    )
    db.add(rec)
    db.commit()
    
    # Test title resolver
    title, _, _ = _resolve_record_title_and_condition(rec)
    
    # Perform various searches via DB simulation
    def search_db(q: str):
        term = f"%{q.lower()}%"
        return db.query(MedicalRecord).filter(
            (MedicalRecord.document_title.ilike(term)) |
            (MedicalRecord.probable_conditions.ilike(term)) |
            (MedicalRecord.detected_medicines.ilike(term)) |
            (MedicalRecord.ai_structured_data.ilike(term))
        ).all()
        
    # Search by condition partial match
    res = search_db("hearing")
    assert len(res) > 0
    assert res[0].document_title == "Prescription — Bilateral Profound Hearing Loss"
    
    # Search by doctor name
    res = search_db("sampurna")
    assert len(res) > 0
    
    # Search by hospital
    res = search_db("sunshine")
    assert len(res) > 0
    
    # Search by medicine
    res = search_db("amphotericin")
    assert len(res) > 0
    
    # Search no match
    res = search_db("paracetamol")
    assert len(res) == 0

    db.close()
