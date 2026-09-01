import pytest
import json
from unittest.mock import patch, MagicMock
from services.gemini_service import _extract_json_object, structure_medical_text, deterministic_extraction
from services.confidence_calculator import ConfidenceCalculator

# A. Gemini response with ```json wrapper
def test_extract_json_object_with_markdown():
    text = "```json\n{\"document_type\": \"prescription\", \"confidence_score\": 95}\n```"
    result = _extract_json_object(text)
    assert result == {"document_type": "prescription", "confidence_score": 95}

# B. Gemini response with conversational prefix
def test_extract_json_object_with_prefix():
    text = "Here is the extracted data:\n```json\n{\"document_type\": \"prescription\"}\n```\nHope this helps!"
    result = _extract_json_object(text)
    assert result == {"document_type": "prescription"}

# C. Malformed Gemini JSON -> AI_PARSE_ERROR
@patch("services.gemini_service.execute_gemini_request_with_retry")
@patch("services.gemini_service.classify_document_heuristic", return_value=("prescription", 50))
def test_malformed_json_gives_parse_error(mock_heuristic, mock_gemini):
    mock_gemini.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Here is the JSON: { malformed json "} ]
                }
            }
        ]
    }
    result = structure_medical_text("Sample text with OCR")
    assert result["ai_status"] == "AI_PARSE_ERROR"

# D. Gemini provider unavailable -> AI_PROVIDER_UNAVAILABLE
@patch("services.gemini_service.execute_gemini_request_with_retry")
@patch("services.gemini_service.classify_document_heuristic", return_value=("prescription", 50))
def test_gemini_unavailable(mock_heuristic, mock_gemini):
    mock_gemini.return_value = {"error": "503 Service Unavailable"}
    result = structure_medical_text("Sample text")
    assert result["ai_status"] == "AI_PROVIDER_UNAVAILABLE"

# E, F, M. Medicines preserved and merged properly without duplicates
@patch("services.gemini_service.MedicineExtractor.extract_medicines")
@patch("services.gemini_service.MedicationValidator.validate_medicines")
@patch("services.gemini_service.execute_gemini_request_with_retry")
@patch("services.gemini_service.classify_document_heuristic", return_value=("prescription", 50))
def test_medicines_preservation(mock_heuristic, mock_gemini, mock_validate, mock_extract):
    # Gemini extracted meds
    mock_gemini.return_value = {
        "candidates": [{"content": {"parts": [{"text": json.dumps({
            "medicines": [{"name": "Med A"}, {"name": "Med B"}]
        })}]}}]
    }
    
    # Deterministic extracted meds
    mock_extract.return_value = [{"name": "Med B"}, {"name": "Med C"}]
    
    # Validation step: Med A verified, Med B unverified, Med C unverified
    mock_validate.return_value = (
        [{"name": "Med A"}], # verified
        [{"name": "Med B", "unverified": True}, {"name": "Med C", "unverified": True}], # unverified
        [], # suspicious
        50.0 # med conf
    )
    
    result = structure_medical_text("Sample OCR text")
    meds = result.get("medicines", [])
    assert len(meds) == 3
    med_names = [m["name"] for m in meds]
    assert set(med_names) == {"Med A", "Med B", "Med C"}
    # Verify unverified flag is present where appropriate
    unverified_meds = [m for m in meds if m.get("unverified")]
    assert len(unverified_meds) == 2

# G, H. Gemini and Deterministic merge
@patch("services.gemini_service.deterministic_extraction")
@patch("services.gemini_service.execute_gemini_request_with_retry")
@patch("services.gemini_service.classify_document_heuristic", return_value=("prescription", 50))
def test_gemini_deterministic_merge(mock_heuristic, mock_gemini, mock_det_ext):
    mock_gemini.return_value = {
        "candidates": [{"content": {"parts": [{"text": json.dumps({
            "doctor_name": "Dr. Gemini",
            "hospital": ""
        })}]}}]
    }
    mock_det_ext.return_value = {
        "doctor_name": "Dr. Deterministic",
        "hospital": "Deterministic Hospital",
        "patient_name": "",
        "prescription_date": "",
        "medicines": []
    }
    
    result = structure_medical_text("Sample text")
    
    # Gemini doctor should win, deterministic hospital should fill in
    assert result.get("ai_status") == "AI_COMPLETED"
    
    # The output from structure_medical_text merges them into doctor_or_hospital or keeps them.
    # We can check ai_summary or doctor/hospital in extracted_data internally.
    # Since structure_medical_text returns a normalized output, we can check ai_summary or something that uses them.
    # Let's just check the string representation or the summary.
    assert "Dr. Gemini" in str(result["ai_summary"])
    assert "Dr. Gemini" in str(result["ai_summary"])
    assert "Deterministic Hospital" in str(result["ai_summary"])

# I. Empty Gemini medicines do not erase deterministic medicines
@patch("services.gemini_service.deterministic_extraction")
@patch("services.gemini_service.execute_gemini_request_with_retry")
@patch("services.gemini_service.classify_document_heuristic", return_value=("prescription", 50))
def test_empty_gemini_medicines_keeps_deterministic(mock_heuristic, mock_gemini, mock_det_ext):
    mock_gemini.return_value = {
        "candidates": [{"content": {"parts": [{"text": json.dumps({
            "doctor_name": "Dr. Smith",
            "medicines": []
        })}]}}]
    }
    mock_det_ext.return_value = {
        "doctor_name": "",
        "hospital": "",
        "patient_name": "",
        "prescription_date": "",
        "medicines": [{"name": "Deterministic Med"}]
    }
    
    result = structure_medical_text("Sample text")
    meds = result.get("medicines", [])
    assert len(meds) == 1
    assert meds[0]["name"] == "Deterministic Med"

# J. OCR variants
def test_deterministic_extraction_ocr_variants():
    text = "De. Stave Johnson\nRIVERSIDE MEDICAL CENTRE"
    result = deterministic_extraction(text, "prescription")
    assert result["doctor_name"] == "Dr. Stave Johnson"
    assert "RIVERSIDE MEDICAL CENTRE" in result["hospital"]

# K. Missing prescription diagnosis does not cause a major confidence penalty
def test_confidence_calculator_missing_diagnosis():
    # Provide essential fields to get high completeness
    extracted_data = {
        "medicines": [{"name": "A"}],
        "doctor_name": "Dr. Smith",
        "hospital": "Hospital",
        "patient_name": "John",
        "prescription_date": "2024-01-01"
    }
    
    scores = ConfidenceCalculator.calculate_comprehensive_confidence(
        ocr_text="Dr. Smith Hospital",
        cleaned_text="Dr. Smith Hospital",
        document_type="prescription",
        classification_confidence=95.0,
        extracted_data=extracted_data,
        ocr_quality=95.0,
        schema_valid=True,
        processing_time=1.0
    )
    
    # Since missing diagnosis is not penalized, score should be > 80
    assert scores["overall_confidence"] > 80.0
