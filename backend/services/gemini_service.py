import json
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

# ===== AI Pipeline Modules =====
from services.document_classifier import (
    classify_document_gemini,
    get_document_type_info,
    should_extract_medicines,
)

from services.ocr_cleaner import OCRCleaner

from services.extraction_schemas import (
    get_extraction_prompt,
    validate_schema,
)

from services.medicine_extractor import MedicineExtractor

from services.confidence_calculator import ConfidenceCalculator

from services.quality_validator import QualityValidator

from services.medication_validator import MedicationValidator

from services.condition_normalizer import ConditionNormalizer

from services.ai_summary_generator import AISummaryGenerator

from services.title_generator import TitleGenerator


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

EMPTY_MEDICAL_INTELLIGENCE = {
    "cleaned_text": "",
    "medicines": [],
    "possible_conditions": [],
    "doctor_or_hospital": "",
    "advice": [],
    "notes": [],
    "classification": "unknown",
    "document_type": "unknown",
    "confidence_score": 0.0,
    "processing_time": 0.0,
    "ocr_quality_score": 0.0,
}


def _empty_result(cleaned_text: str = "") -> dict[str, Any]:
    result = dict(EMPTY_MEDICAL_INTELLIGENCE)
    result["cleaned_text"] = cleaned_text.strip()
    return result


def _extract_json_object(value: str) -> dict[str, Any] | None:
    """Extract JSON from Gemini response, handling markdown code blocks."""
    text = value.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text).strip()

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _normalize_medicines(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    medicines: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in value:
        if isinstance(item, str):
            name = item.strip()
            if name:
                key = (name.lower(), "", "")
                if key not in seen:
                    medicines.append({"name": name, "dosage": "", "duration": ""})
                    seen.add(key)
            continue
        if not isinstance(item, dict):
            continue
        name = re.sub(r"\s+", " ", str(item.get("name") or "").strip())
        if not name:
            continue
        dosage = re.sub(r"\s+", " ", str(item.get("dosage") or "").strip())
        duration = re.sub(r"\s+", " ", str(item.get("duration") or "").strip())
        key = (name.lower(), dosage.lower(), duration.lower())
        if key in seen:
            continue
        seen.add(key)
        medicines.append(
            {
                "name": name,
                "dosage": dosage,
                "duration": duration,
            }
        )
    return medicines


def _normalize_possible_conditions(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    conditions: list[str] = []
    for item in value:
        condition = str(item or "").strip()
        if not condition:
            continue
        condition = re.sub(r"confirmed\s+(disease|diagnosis)\s*:\s*", "", condition, flags=re.I)
        if not condition.lower().startswith("possible related condition:"):
            condition = f"Possible related condition: {condition}"
        conditions.append(condition)
    return conditions


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item or "").strip()]


def _normalize_to_legacy_format(
    extracted_data: dict[str, Any],
    document_type: str,
    cleaned_text: str,
    confidence_score: float,
    processing_time: float,
    ocr_quality: float,
    classification_confidence: float,
    classification_reason: str,
    schema_valid: bool,
    validation_errors: list[str]
) -> dict[str, Any]:
    """Normalize new pipeline result to legacy format for backward compatibility."""
    
    # Extract medicines
    medicines = extracted_data.get("medicines", [])
    normalized_medicines = _normalize_medicines(medicines)
    
    # Extract doctor/hospital (never return None)
    doctor_name = (extracted_data.get("doctor_name") or "").strip()
    hospital = (extracted_data.get("hospital") or "").strip()
    
    # Ensure hospital is never None or empty
    if not hospital:
        hospital = "Unknown"
    
    # Ensure doctor_name is never None (but can be empty if not found)
    if not doctor_name:
        doctor_name = ""
    
    # Format doctor_or_hospital
    if doctor_name and hospital != "Unknown":
        doctor_or_hospital = f"{doctor_name} - {hospital}"
    elif doctor_name:
        doctor_or_hospital = doctor_name
    else:
        doctor_or_hospital = hospital
    
    # Extract conditions (if available) - expanded to capture from multiple fields
    possible_conditions = []
    
    # Check diagnosis field
    if "diagnosis" in extracted_data and extracted_data["diagnosis"]:
        diagnosis = extracted_data["diagnosis"]
        if isinstance(diagnosis, str) and diagnosis.strip():
            possible_conditions.append(f"Possible related condition: {diagnosis}")
        elif isinstance(diagnosis, list):
            for d in diagnosis:
                if isinstance(d, str) and d.strip():
                    possible_conditions.append(f"Possible related condition: {d}")
    
    # Check findings field (for reports, scans, etc.)
    if "findings" in extracted_data and extracted_data["findings"]:
        findings = extracted_data["findings"]
        if isinstance(findings, str) and findings.strip():
            possible_conditions.append(f"Findings: {findings}")
        elif isinstance(findings, list):
            for f in findings:
                if isinstance(f, str) and f.strip():
                    possible_conditions.append(f"Findings: {f}")
    
    # Check impression field (for radiology reports)
    if "impression" in extracted_data and extracted_data["impression"]:
        impression = extracted_data["impression"]
        if isinstance(impression, str) and impression.strip():
            possible_conditions.append(f"Impression: {impression}")
        elif isinstance(impression, list):
            for i in impression:
                if isinstance(i, str) and i.strip():
                    possible_conditions.append(f"Impression: {i}")
    
    # Check possible_conditions field directly (if Gemini returns it)
    if "possible_conditions" in extracted_data and extracted_data["possible_conditions"]:
        conditions = extracted_data["possible_conditions"]
        if isinstance(conditions, list):
            for c in conditions:
                if isinstance(c, str) and c.strip():
                    possible_conditions.append(c)
        elif isinstance(conditions, str) and conditions.strip():
            possible_conditions.append(conditions)
    
    # Extract advice/instructions
    advice = []
    if "instructions" in extracted_data:
        advice = _normalize_string_list(extracted_data["instructions"])
    
    # Extract notes
    notes = _normalize_string_list(extracted_data.get("notes", []))
    
    # Map document type to legacy classification
    # Keep document_type as-is for frontend icon display
    classification_mapping = {
        "prescription": "prescription",
        "blood_report": "blood_report",
        "lab_report": "lab_report",
        "radiology_report": "radiology_report",
        "mri": "mri",
        "ct_scan": "ct_scan",
        "xray": "xray",
        "vaccination_record": "vaccination_record",
        "discharge_summary": "discharge_summary",
        "medical_certificate": "medical_certificate",
        "hospital_bill": "hospital_bill",
        "insurance_document": "insurance_document",
        "referral_letter": "referral_letter",
        "ecg_report": "ecg_report",
        "ultrasound_report": "ultrasound_report",
        "general_medical_report": "general_medical_report",
        "other_medical_document": "other_medical_document"
    }
    legacy_classification = classification_mapping.get(document_type, document_type)
    
    return {
        "cleaned_text": cleaned_text,
        "medicines": normalized_medicines,
        "possible_conditions": possible_conditions,
        "doctor_or_hospital": doctor_or_hospital,
        "advice": advice,
        "notes": notes,
        "classification": legacy_classification,
        # New fields
        "document_type": document_type,
        "confidence_score": confidence_score,
        "processing_time": processing_time,
        "ocr_quality_score": ocr_quality,
        "classification_confidence": classification_confidence,
        "classification_reason": classification_reason,
        "schema_validation_passed": schema_valid,
        "validation_errors": ", ".join(validation_errors) if validation_errors else "",
        "rejected": False,
        "rejection_reason": ""
    }


def infer_conditions_from_medicines(medicines: list, advice: list = None, doctor_or_hospital: str = "") -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return {"possible_conditions": [], "confidence": 0}
    
    medicines_text = "\n".join([f"- {m.get('name', '')} ({m.get('dosage', '')})" for m in medicines])
    advice_text = "\n".join(advice) if advice else "None"
    
    prompt = f"""
You are a medical AI assistant. Given the following extracted medicines from a prescription,
infer ONLY possible related conditions based on the medications.

NEVER produce a diagnosis. These are probabilistic inferences only.

Medicines:
{medicines_text}

Advice:
{advice_text}

Doctor/Hospital:
{doctor_or_hospital}

Return only valid JSON with this exact shape:
{{
  "possible_conditions": ["Type 2 Diabetes", "Hypertension"],
  "confidence": 85
}}

Rules:
- possible_conditions: Array of condition names (without "Possible related condition:" prefix)
- confidence: Integer 0-100 representing confidence level
- If uncertain, return empty array for possible_conditions and 0 for confidence
""".strip()

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        response = requests.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
    except (requests.RequestException, ValueError):
        return {"possible_conditions": [], "confidence": 0}

    candidates = result.get("candidates") or []
    content = candidates[0].get("content", {}) if candidates else {}
    parts = content.get("parts") or []
    text = "\n".join(
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and part.get("text")
    )

    parsed = _extract_json_object(text) if text else None
    if not parsed:
        return {"possible_conditions": [], "confidence": 0}
    
    return {
        "possible_conditions": parsed.get("possible_conditions", []),
        "confidence": parsed.get("confidence", 0)
    }


def calculate_confidence_score(ocr_text: str, gemini_result: dict) -> float:
    """Calculate comprehensive confidence score based on multiple factors.
    
    Factors:
    - OCR text length and quality
    - Number of medicines detected
    - Doctor/hospital detection
    - Conditions detection
    - Gemini's own confidence
    
    Returns: Float 0-100
    """
    score = 0.0
    max_score = 100.0
    
    # Factor 1: OCR text quality (0-25 points)
    ocr_length = len(ocr_text.strip())
    if ocr_length > 500:
        score += 25
    elif ocr_length > 200:
        score += 20
    elif ocr_length > 100:
        score += 15
    elif ocr_length > 50:
        score += 10
    else:
        score += 5
    
    # Factor 2: Medicines detected (0-30 points)
    medicines = gemini_result.get("medicines", [])
    med_count = len(medicines)
    if med_count >= 5:
        score += 30
    elif med_count >= 3:
        score += 25
    elif med_count >= 2:
        score += 20
    elif med_count >= 1:
        score += 15
    
    # Factor 3: Doctor/Hospital detection (0-20 points)
    doctor_or_hospital = (gemini_result.get("doctor_or_hospital") or "").strip()
    if doctor_or_hospital:
        score += 20
    
    # Factor 4: Conditions detection (0-15 points)
    conditions = gemini_result.get("possible_conditions", [])
    if conditions:
        score += 15
    
    # Factor 5: Gemini's own confidence (0-10 points)
    gemini_confidence = gemini_result.get("confidence", 0)
    score += (gemini_confidence / 100) * 10
    
    # Cap at 100
    return min(score, max_score)


def extract_medicines_regex(ocr_text: str) -> list[dict[str, str]]:
    """Regex fallback to extract medicines that Gemini might have missed.
    
    Recognizes medicine prefixes like:
    - Tab, Tablet
    - Cap, Capsule
    - Syp, Syrup
    - Inj, Injection
    - Drop
    - Cream
    - Ointment
    """
    if not ocr_text:
        return []
    
    medicines = []
    seen = set()
    
    # Pattern: [Prefix] [Medicine Name] [Dosage] [Duration]
    # Example: Tab Azithromycin 500mg, Cap Paracetamol, Syp Crocin
    patterns = [
        # Tab/Tab + medicine name
        r'(?:Tab|Tablet)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Cap/Capsule + medicine name
        r'(?:Cap|Capsule)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Syp/Syrup + medicine name
        r'(?:Syp|Syrup)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Inj/Injection + medicine name
        r'(?:Inj|Injection)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Drop + medicine name
        r'(?:Drop)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Cream + medicine name
        r'(?:Cream)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Ointment + medicine name
        r'(?:Ointment)\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)|\s*$)',
        # Standalone medicine names (capitalized, 3+ chars, common medical terms)
        r'\b([A-Z][a-z]{2,}(?:[A-Z][a-z]+)*)\b\s*(\d+(?:\.\d+)?\s*(?:mg|g|ml||mcg|IU)?)?',
    ]
    
    # Non-medicine keywords to filter out
    non_medicine = {
        'life', 'line', 'clinic', 'hospital', 'doctor', 'patient', 'name', 'age', 'sex',
        'date', 'time', 'signature', 'advice', 'note', 'follow', 'up', 'visit', 'report',
        'lab', 'test', 'blood', 'sugar', 'regularly', 'thyroid', 'diabetes', 'centre',
        'center', 'road', 'street', 'phone', 'reg', 'rx', 'md', 'ph', 'pharmacy',
        'medical', 'store', 'no', 'contact', 'mob', 'mobile', 'address', 'city'
    }
    
    for pattern in patterns:
        for match in re.finditer(pattern, ocr_text, re.IGNORECASE | re.MULTILINE):
            name = match.group(1).strip() if match.group(1) else ""
            dosage = match.group(2).strip() if match.lastindex >= 2 and match.group(2) else ""
            
            # Clean up name
            name = re.sub(r'\s+', ' ', name)
            name = name.strip()
            
            # Validate medicine name
            if len(name) < 3:
                continue
            
            # Check if it's a non-medicine keyword
            if name.lower() in non_medicine:
                continue
            
            # Avoid duplicates
            key = (name.lower(), dosage.lower())
            if key in seen:
                continue
            seen.add(key)
            
            medicines.append({
                "name": name,
                "dosage": dosage,
                "duration": ""
            })
    
    print(f"[REGEX FALLBACK] Extracted {len(medicines)} medicines via regex")
    return medicines


def structure_medical_text(ocr_text: str | None) -> dict[str, Any]:
    """
    Production-grade AI Medical Document Understanding Pipeline.
    
    Pipeline:
    1. Document Classification
    2. OCR Cleaning
    3. Document-Specific Extraction
    4. Schema Validation
    5. Medicine Extraction (with heuristics)
    6. Confidence Calculation
    7. Quality Validation
    """
    start_time = time.time()
    source_text = str(ocr_text or "").strip()
    
    if not source_text:
        return _empty_result()
    
    if not GEMINI_API_KEY:
        print(f"[AI PIPELINE] ERROR: GEMINI_API_KEY not configured")
        return _empty_result(source_text)

    print(f"[AI PIPELINE] Starting processing (OCR length: {len(source_text)})")
    
    # Step 1: Document Classification
    print(f"[AI PIPELINE] Step 1: Document Classification")
    classification_result = classify_document_gemini(source_text)
    document_type = classification_result["document_type"]
    classification_confidence = classification_result["confidence"]
    classification_reason = classification_result["reasoning"]
    
    print(f"[AI PIPELINE] Classified as: {document_type} (confidence: {classification_confidence:.1f}%)")
    print(f"[AI PIPELINE] Reason: {classification_reason}")
    
    # Reject non-medical documents early
    if document_type == "not_medical_document":
        print(f"[AI PIPELINE] REJECTED: Document classified as non-medical")
        return {
            **_empty_result(source_text),
            "document_type": "not_medical_document",
            "classification": "non-medical",
            "confidence_score": 0.0,
            "processing_time": time.time() - start_time,
            "ocr_quality_score": 0.0,
            "rejected": True,
            "rejection_reason": "Document classified as non-medical"
        }
    
    # Step 2: OCR Cleaning
    print(f"[AI PIPELINE] Step 2: OCR Cleaning")
    cleaned_text = OCRCleaner.clean(source_text)
    ocr_quality = OCRCleaner.calculate_ocr_quality(cleaned_text)
    print(f"[AI PIPELINE] OCR quality score: {ocr_quality:.1f}")
    
    # Step 3: Document-Specific Extraction
    print(f"[AI PIPELINE] Step 3: Document-Specific Extraction")
    extraction_prompt = get_extraction_prompt(document_type, cleaned_text)
    
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": extraction_prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        print(f"[AI PIPELINE] Calling Gemini API for extraction")
        response = requests.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        print(f"[AI PIPELINE] Gemini API response received")
    except (requests.RequestException, ValueError) as e:
        print(f"[AI PIPELINE] ERROR: Gemini API failed - {e}")
        return {
            **_empty_result(cleaned_text),
            "document_type": document_type,
            "classification": document_type,
            "confidence_score": 0.0,
            "processing_time": time.time() - start_time,
            "ocr_quality_score": ocr_quality,
            "rejected": True,
            "rejection_reason": "Gemini API error"
        }

    candidates = result.get("candidates") or []
    content = candidates[0].get("content", {}) if candidates else {}
    parts = content.get("parts") or []
    text = "\n".join(
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and part.get("text")
    )

    extracted_data = _extract_json_object(text) if text else None
    if not extracted_data:
        print(f"[AI PIPELINE] ERROR: Could not parse Gemini JSON response")
        return {
            **_empty_result(cleaned_text),
            "document_type": document_type,
            "classification": document_type,
            "confidence_score": 0.0,
            "processing_time": time.time() - start_time,
            "ocr_quality_score": ocr_quality,
            "rejected": True,
            "rejection_reason": "Failed to parse Gemini response"
        }
    
    print(f"[AI PIPELINE] Extraction successful")
    print(f"[AI PIPELINE] === GEMINI RAW RESPONSE TRACE ===")
    print(f"[AI PIPELINE] Gemini extracted_data keys: {list(extracted_data.keys())}")
    print(f"[AI PIPELINE] Gemini medicines: {extracted_data.get('medicines', [])}")
    print(f"[AI PIPELINE] Gemini diagnosis: {extracted_data.get('diagnosis', '')}")
    print(f"[AI PIPELINE] Gemini doctor_name: {extracted_data.get('doctor_name', '')}")
    print(f"[AI PIPELINE] Gemini hospital: {extracted_data.get('hospital', '')}")
    print(f"[AI PIPELINE] === END GEMINI RAW RESPONSE TRACE ===")
    
    # Step 4: Schema Validation
    print(f"[AI PIPELINE] Step 4: Schema Validation")
    schema_valid, schema_errors = validate_schema(document_type, extracted_data)
    print(f"[AI PIPELINE] Schema validation: {'PASSED' if schema_valid else 'FAILED'}")
    if schema_errors:
        print(f"[AI PIPELINE] Schema errors: {schema_errors}")
    
    # Step 5: Medicine Extraction (with heuristics)
    print(f"[AI PIPELINE] Step 5: Medicine Extraction")
    if should_extract_medicines(document_type):
        # Use Gemini medicines first
        gemini_medicines = extracted_data.get("medicines", [])
        print(f"[AI PIPELINE] Gemini extracted {len(gemini_medicines)} medicines")
        
        # Apply regex fallback with strict heuristics
        regex_medicines = MedicineExtractor.extract_medicines(cleaned_text, document_type)
        
        # Merge results, avoiding duplicates
        seen_names = {m.get("name", "").lower() for m in gemini_medicines}
        for regex_med in regex_medicines:
            if regex_med["name"].lower() not in seen_names:
                gemini_medicines.append(regex_med)
                seen_names.add(regex_med["name"].lower())
        
        extracted_data["medicines"] = gemini_medicines
        print(f"[AI PIPELINE] Total medicines after merge: {len(gemini_medicines)}")
    else:
        # Clear medicines if not appropriate for this document type
        extracted_data["medicines"] = []
        print(f"[AI PIPELINE] Medicines not extracted for document type: {document_type}")
    
    # Step 6: Medical Knowledge Verification
    print(f"[AI PIPELINE] Step 6: Medical Knowledge Verification")
    print(f"[AI PIPELINE] === BEFORE MEDICINE VALIDATION TRACE ===")
    print(f"[AI PIPELINE] Medicines before validation: {extracted_data.get('medicines', [])}")
    print(f"[AI PIPELINE] Diagnosis before normalization: {extracted_data.get('diagnosis', '')}")
    print(f"[AI PIPELINE] === END BEFORE VALIDATION TRACE ===")
    
    # Validate medicines
    if should_extract_medicines(document_type):
        valid_medicines, suspicious_medicines, medicine_confidence = MedicationValidator.validate_medicines(
            extracted_data.get("medicines", [])
        )
        extracted_data["medicines"] = valid_medicines
        extracted_data["suspicious_medicines"] = suspicious_medicines
        print(f"[AI PIPELINE] Valid medicines: {len(valid_medicines)}, Suspicious: {len(suspicious_medicines)}")
        print(f"[AI PIPELINE] Medicine confidence: {medicine_confidence:.1f}%")
        print(f"[AI PIPELINE] === AFTER MEDICINE VALIDATION TRACE ===")
        print(f"[AI PIPELINE] Medicines after validation: {valid_medicines}")
        print(f"[AI PIPELINE] Suspicious medicines: {suspicious_medicines}")
        print(f"[AI PIPELINE] === END AFTER VALIDATION TRACE ===")
    else:
        extracted_data["medicines"] = []
        extracted_data["suspicious_medicines"] = []
        medicine_confidence = 100.0  # N/A
    
    # Normalize conditions
    diagnosis = extracted_data.get("diagnosis", "")
    if diagnosis:
        normalized_diagnosis = ConditionNormalizer.normalize(diagnosis)
        extracted_data["diagnosis"] = normalized_diagnosis
        print(f"[AI PIPELINE] Normalized diagnosis: {normalized_diagnosis}")
        print(f"[AI PIPELINE] === AFTER CONDITION NORMALIZATION TRACE ===")
        print(f"[AI PIPELINE] Diagnosis after normalization: {normalized_diagnosis}")
        print(f"[AI PIPELINE] === END CONDITION NORMALIZATION TRACE ===")
    
    # Step 7: Confidence Calculation
    print(f"[AI PIPELINE] Step 7: Confidence Calculation")
    processing_time = time.time() - start_time
    confidence_scores = ConfidenceCalculator.calculate_comprehensive_confidence(
        ocr_text=source_text,
        cleaned_text=cleaned_text,
        document_type=document_type,
        classification_confidence=classification_confidence,
        extracted_data=extracted_data,
        ocr_quality=ocr_quality,
        schema_valid=schema_valid,
        processing_time=processing_time
    )
    confidence_score = confidence_scores["overall_confidence"]
    print(f"[AI PIPELINE] Overall confidence: {confidence_score:.1f}%")
    print(f"[AI PIPELINE] Component scores - OCR: {confidence_scores['ocr_confidence']:.1f}%, Medicine: {confidence_scores['medicine_confidence']:.1f}%, Disease: {confidence_scores['disease_confidence']:.1f}%")
    
    # Step 8: Quality Validation
    print(f"[AI PIPELINE] Step 8: Quality Validation")
    print(f"[AI PIPELINE] === BEFORE QUALITY VALIDATION TRACE ===")
    print(f"[AI PIPELINE] extracted_data keys: {list(extracted_data.keys())}")
    print(f"[AI PIPELINE] Medicines: {extracted_data.get('medicines', [])}")
    print(f"[AI PIPELINE] Diagnosis: {extracted_data.get('diagnosis', '')}")
    print(f"[AI PIPELINE] Doctor: {extracted_data.get('doctor_name', '')}")
    print(f"[AI PIPELINE] Hospital: {extracted_data.get('hospital', '')}")
    print(f"[AI PIPELINE] === END BEFORE QUALITY VALIDATION TRACE ===")
    
    is_valid, validation_errors, should_recover = QualityValidator.validate_extraction(
        document_type=document_type,
        extracted_data=extracted_data,
        ocr_text=source_text,
        confidence_score=confidence_score
    )
    
    print(f"[AI PIPELINE] Quality validation result: is_valid={is_valid}, errors={validation_errors}, should_recover={should_recover}")
    
    if not is_valid:
        print(f"[AI PIPELINE] Quality validation FAILED")
        print(f"[AI PIPELINE] Validation errors: {validation_errors}")
        
        # Check if document should be rejected
        if QualityValidator.should_reject_document(document_type, confidence_score, validation_errors):
            print(f"[AI PIPELINE] REJECTED: Document failed quality validation")
            print(f"[AI PIPELINE] === DOCUMENT REJECTED TRACE ===")
            print(f"[AI PIPELINE] Rejection reason: {validation_errors}")
            print(f"[AI PIPELINE] === END REJECTION TRACE ===")
            return {
                **_empty_result(cleaned_text),
                "document_type": document_type,
                "classification": document_type,
                "confidence_score": confidence_score,
                "processing_time": processing_time,
                "ocr_quality_score": ocr_quality,
                "rejected": True,
                "rejection_reason": ", ".join(validation_errors)
            }
        
        # Attempt recovery if appropriate
        if should_recover:
            print(f"[AI PIPELINE] Attempting recovery")
            extracted_data = QualityValidator.attempt_recovery(document_type, extracted_data, source_text)
            print(f"[AI PIPELINE] === AFTER RECOVERY TRACE ===")
            print(f"[AI PIPELINE] Medicines after recovery: {extracted_data.get('medicines', [])}")
            print(f"[AI PIPELINE] Diagnosis after recovery: {extracted_data.get('diagnosis', '')}")
            print(f"[AI PIPELINE] === END RECOVERY TRACE ===")
    else:
        print(f"[AI PIPELINE] Quality validation PASSED")
    
    # Step 9: Generate AI Summary
    print(f"[AI PIPELINE] Step 9: Generate AI Summary")
    ai_summary = AISummaryGenerator.generate_summary(
        document_type=document_type,
        extracted_data=extracted_data,
        medicines=extracted_data.get("medicines", []),
        conditions=[extracted_data.get("diagnosis", "")] if extracted_data.get("diagnosis") else [],
        doctor_name=extracted_data.get("doctor_name", ""),
        hospital=extracted_data.get("hospital", "")
    )
    print(f"[AI PIPELINE] AI summary generated")
    
    # Step 10: Generate Document Title
    print(f"[AI PIPELINE] Step 10: Generate Document Title")
    diagnosis = extracted_data.get("diagnosis", "")
    findings = extracted_data.get("findings", "")
    document_title = TitleGenerator.generate_title(document_type, diagnosis, findings)
    print(f"[AI PIPELINE] Generated title: {document_title}")
    
    # Normalize result to match existing schema
    print(f"[AI PIPELINE] === BEFORE NORMALIZATION TRACE ===")
    print(f"[AI PIPELINE] extracted_data keys: {list(extracted_data.keys())}")
    print(f"[AI PIPELINE] Medicines: {extracted_data.get('medicines', [])}")
    print(f"[AI PIPELINE] Diagnosis: {extracted_data.get('diagnosis', '')}")
    print(f"[AI PIPELINE] === END BEFORE NORMALIZATION TRACE ===")
    
    normalized_result = _normalize_to_legacy_format(
        extracted_data,
        document_type,
        cleaned_text,
        confidence_score,
        processing_time,
        ocr_quality,
        classification_confidence,
        classification_reason,
        schema_valid,
        validation_errors
    )
    
    print(f"[AI PIPELINE] === AFTER NORMALIZATION TRACE ===")
    print(f"[AI PIPELINE] normalized_result keys: {list(normalized_result.keys())}")
    print(f"[AI PIPELINE] normalized_result medicines: {normalized_result.get('medicines', [])}")
    print(f"[AI PIPELINE] normalized_result possible_conditions: {normalized_result.get('possible_conditions', [])}")
    print(f"[AI PIPELINE] === END AFTER NORMALIZATION TRACE ===")
    
    # Add AI summary to result
    normalized_result["ai_summary"] = ai_summary
    
    # Add document title
    normalized_result["document_title"] = document_title
    
    # Add component confidence scores
    normalized_result["component_confidence"] = confidence_scores
    
    print(f"[AI PIPELINE] Pipeline completed successfully")
    print(f"[AI PIPELINE] Document type: {document_type}")
    print(f"[AI PIPELINE] Medicines: {len(normalized_result['medicines'])}")
    print(f"[AI PIPELINE] Confidence: {confidence_score:.1f}%")
    print(f"[AI PIPELINE] Processing time: {processing_time:.2f}s")
    
    return normalized_result
