import pytest
import sys
import os
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, engine, SessionLocal
from models import MedicineMaster
from services.medication_validator import MedicationValidator
from services.quality_validator import QualityValidator
from services.ai_summary_generator import AISummaryGenerator

@pytest.fixture(autouse=True)
def setup_database():
    """Ensure database tables exist and clear MedicineMaster for clean testing state."""
    Base.metadata.create_all(bind=engine)
    # Clear index cache in MedicationValidator so choices reload from current DB inserts
    MedicationValidator._index = None
    with SessionLocal() as db:
        db.query(MedicineMaster).delete()
        db.commit()
    yield
    with SessionLocal() as db:
        db.query(MedicineMaster).delete()
        db.commit()
    MedicationValidator._index = None

def test_extract_descriptors():
    # Strip Tab/Cap/Conventional/Liposomal descriptors case-insensitively
    name, descriptors = MedicationValidator.extract_descriptors("Tab Paracetamol")
    assert name == "Paracetamol"
    assert descriptors == ["Tab"]

    name2, descriptors2 = MedicationValidator.extract_descriptors("Conventional Amphotericin B")
    assert name2 == "Amphotericin B"
    assert descriptors2 == ["Conventional"]

    name3, descriptors3 = MedicationValidator.extract_descriptors("Liposomal Conventional Inj Amphotericin B Syrup")
    assert "Amphotericin B" in name3
    assert "Liposomal" in descriptors3
    assert "Conventional" in descriptors3
    assert "Inj" in descriptors3
    assert "Syrup" in descriptors3

def test_alias_normalization_exact_match():
    # Insert base drug in master database
    with SessionLocal() as db:
        med = MedicineMaster(
            name="Paracetamol",
            generic_name="Paracetamol",
            brand_name="Paracetamol",
            strength="500mg",
            route="Oral"
        )
        db.add(med)
        db.commit()

    # Query with alias
    match = MedicationValidator.find_best_match("Tab Paracetamol")
    assert match["is_valid"] is True
    assert match["corrected_name"] == "Paracetamol"
    assert match["formulation_metadata"] == ["Tab"]

def test_alias_normalization_fuzzy_match():
    with SessionLocal() as db:
        med = MedicineMaster(
            name="Amphotericin B",
            generic_name="Amphotericin B",
            brand_name="Amphotericin B",
            strength="50mg",
            route="Intravenous"
        )
        db.add(med)
        db.commit()

    # Trigger fuzzy match load index
    MedicationValidator._index = None
    
    match = MedicationValidator.find_best_match("Conventional Amphotericin B")
    assert match["is_valid"] is True
    assert match["corrected_name"] == "Amphotericin B"
    assert match["formulation_metadata"] == ["Conventional"]
    assert match["confidence"] >= 80

def test_two_tier_validation():
    with SessionLocal() as db:
        med = MedicineMaster(
            name="Aspirin",
            generic_name="Aspirin",
            brand_name="Aspirin",
            strength="150mg",
            route="Oral"
        )
        db.add(med)
        db.commit()

    MedicationValidator._index = None

    medicines_list = [
        {"name": "Tab Aspirin", "dosage": "150mg", "duration": "5 days", "frequency": "Once daily"},
        {"name": "SomeRandomXYZ Drug", "dosage": "10mg", "duration": "3 days", "frequency": "Twice daily"}
    ]

    verified, unverified, suspicious, confidence = MedicationValidator.validate_medicines(medicines_list)

    # 1 verified medicine (Aspirin)
    assert len(verified) == 1
    assert verified[0]["name"] == "Aspirin"
    assert verified[0]["generic_name"] == "Aspirin"
    assert "formulation_metadata" in verified[0]

    # 1 unverified medicine (SomeRandomXYZ Drug)
    assert len(unverified) == 1
    assert unverified[0]["name"] == "SomeRandomXYZ Drug"
    assert unverified[0]["unverified"] is True
    assert unverified[0]["validation_reason"] in ["low_fuzzy_score", "medicine_database_empty"]

    assert len(suspicious) == 0

def test_quality_validator_unverified_not_reported_empty():
    extracted_data = {
        "diagnosis": "Fever",
        "doctor_name": "Dr. Smith",
        "hospital": "City Hospital",
        "medicines": [],
        "unverified_medicines": [
            {"name": "SomeRandomXYZ Drug", "dosage": "10mg", "frequency": "1-0-1", "duration": "3 days"}
        ]
    }

    # Should pass the minimum prescription count validation (doesn't report "No medicines found")
    errors = QualityValidator._check_minimum_requirements("prescription", extracted_data)
    assert "Incomplete prescription: No medicines found" not in errors

def test_quality_validator_attempt_recovery_promotes_unverified():
    extracted_data = {
        "diagnosis": "Fever",
        "doctor_name": "Dr. Smith",
        "hospital": "City Hospital",
        "medicines": [],
        "unverified_medicines": [
            {"name": "SomeRandomXYZ Drug", "dosage": "10mg", "frequency": "1-0-1", "duration": "3 days"}
        ]
    }

    recovered = QualityValidator.attempt_recovery("prescription", extracted_data, "OCR Text")
    
    # Verify that unverified medicine is promoted to 'medicines' list
    assert len(recovered["medicines"]) == 1
    assert recovered["medicines"][0]["name"] == "SomeRandomXYZ Drug"
    assert recovered["medicines"][0]["requires_manual_review"] is True

def test_ai_summary_distinguishes_verified_unverified():
    extracted_data = {
        "diagnosis": "Fever",
        "doctor_name": "Dr. Smith",
        "hospital": "City Hospital",
        "verified_medicines": [
            {"name": "Aspirin", "dosage": "150mg", "duration": "5 days"}
        ],
        "unverified_medicines": [
            {"name": "SomeNewHerb", "dosage": "1 scoop", "duration": "10 days"}
        ]
    }

    summary = AISummaryGenerator.generate_summary(
        document_type="prescription",
        extracted_data=extracted_data,
        medicines=[],
        conditions=["Fever"],
        doctor_name="Dr. Smith",
        hospital="City Hospital"
    )

    med_summary_text = summary["medicines"]
    # Key assertions: distinguishes verified and unverified
    assert "Verified:" in med_summary_text
    assert "Aspirin" in med_summary_text
    assert "Unverified:" in med_summary_text
    assert "SomeNewHerb" in med_summary_text
