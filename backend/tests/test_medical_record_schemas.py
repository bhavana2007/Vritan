import json
from schemas import MedicalRecordPublic, DetectedMedicine

def test_case_a_rich_medicine():
    # A. Medicine with:
    #     food_instructions=None
    #     confidence=100
    #     formulation_metadata=["Inj", "Liposomal"]
    data = {
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
        "route": ""
    }
    med = DetectedMedicine.model_validate(data)
    assert med.name == "amphotericin B"
    assert med.food_instructions is None
    assert med.confidence == 100.0
    assert med.formulation_metadata == ["Inj", "Liposomal"]
    assert med.generic_name == "amphotericin B"

def test_case_b_float_confidence_empty_formulation():
    # B. Medicine with:
    #     confidence=73.5
    #     formulation_metadata=[]
    data = {
        "name": "paracetamol",
        "dosage": "500 mg",
        "confidence": 73.5,
        "formulation_metadata": []
    }
    med = DetectedMedicine.model_validate(data)
    assert med.name == "paracetamol"
    assert med.confidence == 73.5
    assert med.formulation_metadata == []

def test_case_c_unverified_medicine():
    # C. Unverified medicine with:
    #     requires_manual_review=True
    data = {
        "name": "UnknownMed",
        "requires_manual_review": True
    }
    med = DetectedMedicine.model_validate(data)
    assert med.name == "UnknownMed"
    # Ensure extra fields are preserved
    assert getattr(med, "requires_manual_review", None) is True
    # Test dictionary-like compatibility get method
    assert med.get("requires_manual_review") is True
    assert med.get("name") == "UnknownMed"
    assert med.get("non_existent_field", "default") == "default"

def test_case_d_legacy_medicine():
    # D. Legacy medicine object missing the new optional fields.
    data = {
        "name": "ibuprofen",
        "dosage": "400 mg"
    }
    med = DetectedMedicine.model_validate(data)
    assert med.name == "ibuprofen"
    assert med.dosage == "400 mg"
    assert med.confidence is None
    assert med.formulation_metadata == []
    assert med.food_instructions is None

def test_extra_metadata_preservation():
    # Additional requirement: explicitly test that arbitrary modern medicine metadata
    # such as requires_manual_review, suspicious_reason, and future validation metadata
    # survives DetectedMedicine parsing and serialization.
    data = {
        "name": "aspirin",
        "requires_manual_review": True,
        "suspicious_reason": "high_dosage_threshold",
        "future_validation_metadata": {"key": "val"}
    }
    med = DetectedMedicine.model_validate(data)
    assert med.name == "aspirin"
    assert med.get("requires_manual_review") is True
    assert med.get("suspicious_reason") == "high_dosage_threshold"
    assert med.get("future_validation_metadata") == {"key": "val"}
    
    # Verify that these fields survive dump/serialization
    dumped = med.model_dump()
    assert dumped["name"] == "aspirin"
    assert dumped["requires_manual_review"] is True
    assert dumped["suspicious_reason"] == "high_dosage_threshold"
    assert dumped["future_validation_metadata"] == {"key": "val"}

def test_case_e_full_medical_record_public_serialization():
    # E. Full MedicalRecordPublic serialization.
    # Test both object input and JSON string inputs for serialized database fields.
    record_data = {
        "id": 1,
        "record_type": "prescription",
        "file_url": "/records/1/file",
        "original_filename": "presc.pdf",
        "display_title": "Prescription 1",
        "notes": "Some notes",
        "detected_medicines": json.dumps([
            {
                "name": "amphotericin B",
                "food_instructions": None,
                "confidence": 100,
                "formulation_metadata": ["Inj", "Liposomal"],
                "requires_manual_review": False
            },
            {
                "name": "paracetamol",
                "confidence": 73.5,
                "formulation_metadata": [],
                "suspicious_reason": "none"
            }
        ]),
        "probable_conditions": json.dumps(["Fever", "Infection"]),
        "ai_structured_data": json.dumps({
            "possible_conditions": ["Fever", "Infection"],
            "confidence": 95.0,
            "summary": "AI Summary text",
            "doctor_or_hospital": "City Hospital"
        }),
        "ai_summary": json.dumps("AI Summary text"),
        "component_confidence": json.dumps({"medicines": 1.0, "diagnosis": 0.9})
    }
    
    # Validate from attributes
    record = MedicalRecordPublic.model_validate(record_data)
    assert record.id == 1
    assert len(record.detected_medicines) == 2
    assert record.detected_medicines[0].name == "amphotericin B"
    assert record.detected_medicines[0].confidence == 100.0
    assert record.detected_medicines[0].formulation_metadata == ["Inj", "Liposomal"]
    assert record.detected_medicines[0].get("requires_manual_review") is False
    
    assert record.detected_medicines[1].name == "paracetamol"
    assert record.detected_medicines[1].confidence == 73.5
    assert record.detected_medicines[1].formulation_metadata == []
    assert record.detected_medicines[1].get("suspicious_reason") == "none"

    assert record.probable_conditions == ["Fever", "Infection"]
    assert record.ai_structured_data["confidence"] == 95.0
    assert record.ai_summary == "AI Summary text"
    assert record.component_confidence == {"medicines": 1.0, "diagnosis": 0.9}

    # Verify JSON serialization
    serialized = record.model_dump()
    assert serialized["detected_medicines"][0]["name"] == "amphotericin B"
    assert serialized["detected_medicines"][0]["requires_manual_review"] is False
    assert serialized["detected_medicines"][1]["suspicious_reason"] == "none"
    assert serialized["probable_conditions"] == ["Fever", "Infection"]
    assert serialized["ai_structured_data"]["confidence"] == 95.0
    assert serialized["ai_summary"] == "AI Summary text"
    assert serialized["component_confidence"] == {"medicines": 1.0, "diagnosis": 0.9}
