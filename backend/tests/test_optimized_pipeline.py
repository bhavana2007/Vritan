import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
import json
import requests
import io
import fitz  # PyMuPDF

from services.gemini_service import (
    structure_medical_text,
    sanitize_log_message,
    deterministic_extraction,
    execute_gemini_request_with_retry
)
from services.ocr_service import extract_text_from_file

# Mock data matching schema expectations for a complex case
MOCK_GEMINI_JSON = {
    "document_type": "prescription",
    "classification_confidence": 95,
    "classification_reason": "Contains letterhead and medicines",
    "rejected": False,
    "rejection_reason": None,
    "patient_name": "Alice Smith",
    "doctor_name": "Dr. John Doe",
    "hospital": "City Clinic",
    "date": "2026-08-08",
    "diagnosis": "Hypertension",
    "symptoms": ["headache", "dizziness"],
    "clinical_findings": ["BP 140/90"],
    "medicines": [
        {
            "name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "TDS",
            "duration": "5 days",
            "food_instructions": "after food",
            "instructions": ""
        }
    ],
    "advice": ["Rest"],
    "allergies": []
}


def test_a_simple_document_zero_calls():
    """
    Test A: Simple document -> 0 provider calls.
    High confidence / selectable digital PDF content should bypass Gemini.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text = "Patient: Alice Smith\nDoctor: Dr. John Doe\nHospital: City Clinic\nDate: 2026-08-08\nTab Paracetamol 500mg"
        with patch("services.gemini_service.requests.post") as mock_post:
            res = structure_medical_text(ocr_text, is_digital=True)
            
            # Assertions
            provider_call_count = mock_post.call_count
            print(f"[TEST MEASUREMENT] test_a_simple_document_zero_calls provider calls: {provider_call_count}")
            assert provider_call_count == 0
            assert provider_call_count <= 1
            assert res["ai_status"] == "DETERMINISTIC_COMPLETED"


def test_b_complex_document_exactly_one_call():
    """
    Test B: Complex document -> exactly 1 provider call.
    Low confidence scan should run exactly 1 provider call, never more.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text_low = "P@tient: Al1ce\nDoct0r: Dr. J0hn\n"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": json.dumps(MOCK_GEMINI_JSON)}]
                }
            }]
        }
        
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text(ocr_text_low, is_digital=False)
            
            # Assertions
            provider_call_count = mock_post.call_count
            print(f"[TEST MEASUREMENT] test_b_complex_document_exactly_one_call provider calls: {provider_call_count}")
            assert provider_call_count == 1
            assert provider_call_count <= 1
            assert res["ai_status"] == "AI_COMPLETED"


def test_c_gemini_429_exactly_one_call_fallback():
    """
    Test C: Gemini 429 -> exactly 1 provider call, then fallback.
    Under 429 rate limit, should not retry; fallback immediately.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text = "Patient: Alice Smith\nDoctor: Dr. John Doe\nHospital: City Clinic\n"
        mock_response = MagicMock()
        mock_response.status_code = 429
        
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text(ocr_text, is_digital=False)
            
            # Assertions
            provider_call_count = mock_post.call_count
            print(f"[TEST MEASUREMENT] test_c_gemini_429_exactly_one_call_fallback provider calls: {provider_call_count}")
            assert provider_call_count == 1
            assert provider_call_count <= 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_d_gemini_timeout_error_exactly_one_call_fallback():
    """
    Test D: Gemini timeout/provider error -> exactly 1 provider call, then fallback.
    Under network/provider timeout request exceptions, should not retry; fallback immediately.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text = "Patient: Alice Smith\nDoctor: Dr. John Doe\nHospital: City Clinic\n"
        
        with patch("services.gemini_service.requests.post", side_effect=requests.exceptions.Timeout("Request timed out")) as mock_post:
            res = structure_medical_text(ocr_text, is_digital=False)
            
            # Assertions
            provider_call_count = mock_post.call_count
            print(f"[TEST MEASUREMENT] test_d_gemini_timeout_error_exactly_one_call_fallback provider calls: {provider_call_count}")
            assert provider_call_count == 1
            assert provider_call_count <= 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_e_gemini_success_exactly_one_call():
    """
    Test E: Gemini success -> exactly 1 provider call containing both classification and extraction.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text = "Patient: Alice Smith\nDoctor: Dr. John Doe\nHospital: City Clinic\n"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": json.dumps(MOCK_GEMINI_JSON)}]
                }
            }]
        }

        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text(ocr_text, is_digital=False)
            
            # Assertions
            provider_call_count = mock_post.call_count
            print(f"[TEST MEASUREMENT] test_e_gemini_success_exactly_one_call provider calls: {provider_call_count}")
            assert provider_call_count == 1
            assert provider_call_count <= 1
            
            # Verify details returned
            assert res["document_type"] == "prescription"
            assert res["confidence_score"] > 0
            
            # Medicines extraction list checks
            assert len(res["medicines"]) > 0 or len(res["unverified_medicines"]) > 0
            meds_list = res["medicines"] if res["medicines"] else res["unverified_medicines"]
            assert meds_list[0]["name"] == "Paracetamol"
            assert res["ai_status"] == "AI_COMPLETED"


def test_security_audit_api_key_redacted():
    """
    Verify security sanitization logic works under any key setup.
    """
    key = "AIzaSyFakeKey12345XYZ"
    with patch("services.gemini_service.GEMINI_API_KEY", key):
        test_msg = f"Failed to post to https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={key}"
        sanitized = sanitize_log_message(test_msg)
        assert key not in sanitized
        assert "key=REDACTED" in sanitized


def test_digital_pdf_format_aware():
    """
    Verify that digitally generated documents bypass unnecessary OCR using native PDF text extraction.
    """
    pdf_path = Path("test_digital.pdf")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Patient Name: Alice Smith\nDoctor Name: Dr. John Doe\nHospital: City Clinic\nDate: 2026-08-08\nMedicine: Paracetamol 500mg TDS for 5 days")
    doc.save(pdf_path)
    doc.close()

    try:
        with patch("services.ocr_service.OCR_API_KEY", "mock_key"):
            with patch("requests.post") as mock_post:
                text = extract_text_from_file(pdf_path)
                assert "Alice Smith" in text
                assert "Dr. John Doe" in text
                # Bypassed OCR Space network API request!
                mock_post.assert_not_called()
    finally:
        pdf_path.unlink(missing_ok=True)


def test_regression_group_1_extraction_works():
    """
    Test 1: A regex with capture group 1 → extraction works.
    """
    text = "Patient: John Doe"
    res = deterministic_extraction(text, "prescription")
    assert res["patient_name"] == "John Doe"


def test_regression_no_group_1_safe_match():
    """
    Test 2: A regex without capture group 1 → no IndexError; complete match is safely handled.
    We test with date pattern (which triggers the regex without group 1).
    """
    # Matches the date regex \b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b which has no capture groups
    text = "The prescription date was 18/5/2021."
    res = deterministic_extraction(text, "prescription")
    assert res["prescription_date"] == "18/5/2021"


def test_regression_real_ocr_text_no_crash():
    """
    Test 3: A real OCR text similar to the user provided example:
    YASHODA
    HOSPITALS
    ...
    must pass deterministic pre-analysis without crashing.
    """
    real_ocr = (
        "YASHODA\n"
        "HOSPITALS\n"
        "DEA SINKATRSMARA RAO\n"
        "eg ho lIIT7\n"
        "tede osces cocal\n"
        "18/5/2021\n"
        "Mn Venkateshwar Papuri"
    )
    # This must run without throwing IndexError: no such group
    res = deterministic_extraction(real_ocr, "laboratory_report")
    assert res is not None
    # Verify date is safely matched without crash
    assert res["prescription_date"] == "18/5/2021"


def test_regression_extraction_partial_failure_continues():
    """
    Test 4: If deterministic extraction partially fails, the remaining pipeline continues.
    """
    with patch("services.gemini_service.deterministic_extraction", side_effect=ValueError("Simulated error")):
        # The pipeline must not crash when deterministic_extraction raises an error
        # and instead continues processing (falling back or proceeding to Gemini).
        with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
            ocr_text = "Patient: Alice Smith\nDoctor: Dr. John Doe\nHospital: City Clinic\nDate: 2026-08-08\nTab Paracetamol 500mg"
            # It will fall back to Gemini because deterministic_extraction fails
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps(MOCK_GEMINI_JSON)}]
                    }
                }]
            }
            with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
                res = structure_medical_text(ocr_text, is_digital=True)
                assert res["ai_status"] == "AI_COMPLETED"
                # Strictly at most 1 call
                assert mock_post.call_count == 1
                assert mock_post.call_count <= 1


def test_regression_complex_document_max_one_call():
    """
    Test 5: Complex document still makes at most ONE Gemini provider call.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        ocr_text = "Low quality scanned text with bad OCR quality."
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": json.dumps(MOCK_GEMINI_JSON)}]
                }
            }]
        }
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text(ocr_text, is_digital=False)
            assert res["ai_status"] == "AI_COMPLETED"
            assert mock_post.call_count <= 1


def test_regression_gemini_multimodal_success():
    """
    1. Gemini successful multimodal request:
       provider calls = 1, classification + extraction returned.
    """
    import tempfile
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(b"fake image data")
            tmp_path = Path(tmp.name)
            
        try:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "candidates": [{
                    "content": {
                        "parts": [{"text": json.dumps(MOCK_GEMINI_JSON)}]
                    }
                }]
            }
            with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
                res = structure_medical_text("OCR Text", file_path=tmp_path, is_digital=False)
                assert mock_post.call_count == 1
                assert res["ai_status"] == "AI_COMPLETED"
                # Check that multi-modal info is logged and payload contains image part
                payload = mock_post.call_args[1]["json"]
                parts = payload["contents"][0]["parts"]
                assert len(parts) == 2
                assert "inlineData" in parts[1]
                assert parts[1]["inlineData"]["mimeType"] == "image/jpeg"
        finally:
            tmp_path.unlink(missing_ok=True)


def test_regression_gemini_429_diagnostics():
    """
    2. Gemini 429:
       provider calls = 1, no retry, fallback executed.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        mock_response = MagicMock()
        mock_response.status_code = 429
        
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text("Prescription content", is_digital=False)
            assert mock_post.call_count == 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_regression_gemini_400_diagnostics():
    """
    3. Gemini 400:
       provider calls = 1, no retry, fallback executed.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "error": {
                "code": 400,
                "message": "API key not valid",
                "status": "INVALID_ARGUMENT"
            }
        }
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text("Prescription content", is_digital=False)
            assert mock_post.call_count == 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_regression_gemini_timeout():
    """
    4. Gemini timeout:
       provider calls = 1, no retry, fallback executed.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        with patch("services.gemini_service.requests.post", side_effect=requests.exceptions.Timeout("Connection timed out")) as mock_post:
            res = structure_medical_text("Prescription content", is_digital=False)
            assert mock_post.call_count == 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_regression_gemini_malformed_response():
    """
    5. Invalid/malformed Gemini response:
       provider calls = 1, safe fallback.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", "mock_key"):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Mangled body text")
        with patch("services.gemini_service.requests.post", return_value=mock_response) as mock_post:
            res = structure_medical_text("Prescription details", is_digital=False)
            assert mock_post.call_count == 1
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"


def test_regression_api_key_missing():
    """
    6. API key missing:
       provider calls = 0, safe configuration failure, deterministic fallback.
    """
    with patch("services.gemini_service.GEMINI_API_KEY", None):
        with patch("services.gemini_service.requests.post") as mock_post:
            res = structure_medical_text("Tab Paracetamol 500mg", is_digital=False)
            assert mock_post.call_count == 0
            assert res["ai_status"] == "AI_PROVIDER_UNAVAILABLE"
            assert res["ai_summary"]["summary"] == "AI summary unavailable. Local fallback processing was used."


def test_regression_deterministic_noisy_ocr_meds():
    """
    7. Deterministic prescription extraction:
       noisy OCR must never produce an unverified hallucinated medicine if it matches layout terms / people names.
    """
    noisy_ocr = (
        "YASHODA HOSPITALS\n"
        "DEA VINKATRSMARA RAO\n"
        "18/5/2021\n"
        "Mn Venkateshwar Papuri\n"
        "900 mg IV OD\n"
        "Amephotencin B\n"
        "RandomText 500mg"
    )
    with patch("services.gemini_service.GEMINI_API_KEY", None):
        res = structure_medical_text(noisy_ocr, is_digital=False)
    
    # Extract medicines lists
    all_extracted_names = [m["name"].lower() for m in res.get("medicines", []) + res.get("unverified_medicines", [])]
    
    # Assertions
    assert "yashoda" not in all_extracted_names
    assert "hospitals" not in all_extracted_names
    assert "venkateshwar" not in all_extracted_names
    assert "papuri" not in all_extracted_names
    assert "randomtext" not in all_extracted_names

