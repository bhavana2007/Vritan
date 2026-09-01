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
    classify_document_heuristic,
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
GEMINI_MODEL = "gemini-3.5-flash"
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
    """Extract JSON from Gemini response, handling markdown code blocks and conversational prefixes."""
    text = value.strip()
    
    # Try direct parsing first
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass
        
    # Remove markdown formatting if present
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s*```$", "", text).strip()
    
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    # Find the outermost JSON object
    # Using find and rfind to be robust against newlines and nested braces
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        json_str = text[first_brace:last_brace+1]
        try:
            parsed = json.loads(json_str)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError as e:
            print(f"[AI] JSON extraction failed. Error: {e}. Truncated preview: {json_str[:100]}...")
            return None

    return None


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
        
        # Build dictionary keeping all properties of item. Since item might have extra fields, let's preserve them!
        med_dict = {
            "name": name,
            "dosage": dosage,
            "duration": duration,
        }
        for k, v in item.items():
            if k not in med_dict:
                med_dict[k] = v
        medicines.append(med_dict)
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
        "verified_medicines": _normalize_medicines(extracted_data.get("verified_medicines", [])),
        "unverified_medicines": _normalize_medicines(extracted_data.get("unverified_medicines", [])),
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


def sanitize_log_message(msg: str) -> str:
    if not msg:
        return ""
    if GEMINI_API_KEY:
        msg = msg.replace(GEMINI_API_KEY, "REDACTED")
    msg = re.sub(r'key=[A-Za-z0-9_\-]+', 'key=REDACTED', msg)
    return msg


def get_multimodal_parts(file_path: Path) -> dict | None:
    suffix = file_path.suffix.lower()
    mime_map = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    }
    mime_type = mime_map.get(suffix)
    if not mime_type:
        return None
    try:
        import base64
        if suffix == ".pdf":
            page_0 = file_path.parent / f"{file_path.name}_page_0.jpg"
            if not page_0.exists():
                page_0 = file_path.parent / f"{file_path.stem}_page_0.jpg"
            if page_0.exists():
                file_path = page_0
                mime_type = "image/jpeg"
                print(f"[AI] Gemini: using converted PDF page image instead: {page_0}")
        
        data = file_path.read_bytes()
        if len(data) > 15 * 1024 * 1024:
            print(f"[AI] Gemini: Image too large to send inline ({len(data)} bytes)")
            return None
            
        base64_data = base64.b64encode(data).decode('utf-8')
        return {
            "inlineData": {
                "mimeType": mime_type,
                "data": base64_data
            }
        }
    except Exception as e:
        print(f"[AI] Gemini: Failed to load image details - {e}")
        return None


def deterministic_extraction(text: str, document_type: str) -> dict[str, Any]:
    def safe_extract_match(m: re.Match) -> str:
        try:
            val = m.group(1)
            if val is not None:
                return val.strip()
        except IndexError:
            pass
        try:
            return m.group(0).strip()
        except Exception:
            return ""

    patient_patterns = [
        r'(?i)patient\s*(?:name)?\s*:\s*([A-Za-z\s.\n]{2,30})',
        r'(?i)patient\s*:\s*([A-Za-z\s.\n]{2,30})',
        r'(?i)name\s*:\s*([A-Za-z\s.\n]{2,30})'
    ]
    patient_name = ""
    for p in patient_patterns:
        try:
            m = re.search(p, text)
            if m:
                candidate = safe_extract_match(m)
                candidate = candidate.split("\n")[0].strip()
                if len(candidate) > 2 and not any(kw in candidate.lower() for kw in ["date", "age", "sex", "gender", "prescription"]):
                    patient_name = candidate
                    break
        except Exception as e:
            print(f"[AI] Deterministic extraction: failed rule patient pattern {p}: {e}")

    doctor_patterns = [
        r'(?i)doctor\s*(?:name)?\s*:\s*([A-Za-z\s.\n]{2,30})',
        r'(?i)dr\.\s*([A-Za-z\s.\n]{2,30})',
        r'(?i)dr\s+([A-Za-z\s.\n]{2,30})',
        r'(?i)de\.\s*([A-Za-z\s.\n]{2,30})',  # OCR variant
        r'(?i)physician\s*:\s*([A-Za-z\s.\n]{2,30})'
    ]
    doctor_name = ""
    for p in doctor_patterns:
        try:
            m = re.search(p, text)
            if m:
                candidate = safe_extract_match(m)
                candidate = candidate.split("\n")[0].strip()
                if len(candidate) > 2 and not any(kw in candidate.lower() for kw in ["patient", "hospital", "clinic", "date"]):
                    if not candidate.lower().startswith("dr.") and "dr" not in candidate.lower()[:3]:
                        doctor_name = f"Dr. {candidate}"
                    else:
                        doctor_name = candidate
                    break
        except Exception as e:
            print(f"[AI] Deterministic extraction: failed rule doctor pattern {p}: {e}")

    hospital_patterns = [
        r'(?i)hospital\s*(?:name)?\s*:\s*([A-Za-z0-9\s.,\-\n]{3,50})',
        r'(?i)clinic\s*(?:name)?\s*:\s*([A-Za-z0-9\s.,\-\n]{3,50})',
        r'(?i)medical\s+center\s*:\s*([A-Za-z0-9\s.,\-\n]{3,50})',
        r'(?im)^(.{0,50}(?:HOSPITAL|MEDICAL CENTRE|MEDICAL CENTER|CLINIC|HEALTHCARE).{0,50})$'
    ]
    hospital = ""
    for p in hospital_patterns:
        try:
            m = re.search(p, text)
            if m:
                candidate = safe_extract_match(m)
                candidate = candidate.split("\n")[0].strip()
                if len(candidate) > 3 and not any(kw in candidate.lower() for kw in ["patient", "doctor", "date", "name"]):
                    hospital = candidate
                    break
        except Exception as e:
            print(f"[AI] Deterministic extraction: failed rule hospital pattern {p}: {e}")

    date_patterns = [
        r'(?i)date\s*:\s*([0-9a-zA-Z\s,/\-\n]{6,20})',
        r'(?i)prescription\s+date\s*:\s*([0-9a-zA-Z\s,/\-\n]{6,20})',
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'
    ]
    document_date = ""
    for p in date_patterns:
        try:
            m = re.search(p, text)
            if m:
                candidate = safe_extract_match(m)
                candidate = candidate.split("\n")[0].strip()
                document_date = candidate
                break
        except Exception as e:
            print(f"[AI] Deterministic extraction: failed rule date pattern {p}: {e}")

    medicines = []
    try:
        medicines = MedicineExtractor.extract_medicines(text, document_type)
    except Exception as e:
        print(f"[AI] Deterministic extraction: failed medicine extraction: {e}")

    return {
        "patient_name": patient_name,
        "doctor_name": doctor_name,
        "hospital": hospital,
        "prescription_date": document_date,
        "medicines": medicines
    }


def execute_gemini_request_with_retry(payload: dict) -> dict | None:
    print("[AI] Gemini request 1/1")
    print("[AI] Combined classification + extraction")
    
    # Check if multimodal payload was included
    has_image = False
    try:
        parts = payload.get("contents", [{}])[0].get("parts", [])
        if len(parts) > 1:
            has_image = any(isinstance(p, dict) and "inlineData" in p for p in parts)
    except Exception:
        pass

    response = None
    try:
        response = requests.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=45
        )
        if response.status_code == 429:
            print("[AI] Gemini failure category: RATE_LIMIT")
            print("[AI] Gemini HTTP status: 429")
            print(f"[AI] Gemini model: {GEMINI_MODEL}")
            print(f"[AI] Gemini multimodal payload included: {str(has_image).lower()}")
            print("[AI] Gemini request 1/1 rate limited")
            print("[AI] No Gemini retry — request budget exhausted")
            print("[AI] Falling back to deterministic processing")
            return {"error": "429_rate_limited"}

        if response.status_code != 200:
            status_code = response.status_code
            err_msg = ""
            status_str = "API_ERROR"
            try:
                err_data = response.json()
                err_node = err_data.get("error", {})
                err_msg = err_node.get("message", "")
                status_str = err_node.get("status", "API_ERROR")
            except Exception:
                err_msg = response.text[:200]

            print(f"[AI] Gemini failure category: {status_str}")
            print(f"[AI] Gemini HTTP status: {status_code}")
            print(f"[AI] Gemini model: {GEMINI_MODEL}")
            print(f"[AI] Gemini multimodal payload included: {str(has_image).lower()}")
            print(f"[AI] Gemini failure detail: {sanitize_log_message(err_msg)}")
            print("[AI] Gemini request failed during HTTP response")
            print("[AI] No Gemini retry — request budget exhausted")
            print("[AI] Falling back to deterministic processing")
            return {"error": "api_error", "status": status_str, "status_code": status_code}

        print("[AI] Gemini success")
        try:
            return response.json()
        except Exception as parse_err:
            print("[AI] Gemini failure category: RESPONSE_PARSE_ERROR")
            print("[AI] Gemini HTTP status: 200")
            print(f"[AI] Gemini model: {GEMINI_MODEL}")
            print(f"[AI] Gemini multimodal payload included: {str(has_image).lower()}")
            print("[AI] Gemini response received but structured JSON parsing failed")
            print("[AI] No Gemini retry — request budget exhausted")
            print("[AI] Falling back to deterministic processing")
            return {"error": "parse_error", "details": str(parse_err)}

    except requests.exceptions.RequestException as e:
        status_code = None
        status_str = "NETWORK_ERROR"
        if response is not None:
            status_code = response.status_code
        elif e.response is not None:
            status_code = e.response.status_code

        err_msg = sanitize_log_message(str(e))
        print(f"[AI] Gemini failure category: {status_str}")
        if status_code is not None:
            print(f"[AI] Gemini HTTP status: {status_code}")
        print(f"[AI] Gemini model: {GEMINI_MODEL}")
        print(f"[AI] Gemini multimodal payload included: {str(has_image).lower()}")
        print(f"[AI] Gemini failure detail: {err_msg}")
        print("[AI] Gemini request failed before or during HTTP transmission")
        print("[AI] No Gemini retry — request budget exhausted")
        print("[AI] Falling back to deterministic processing")
        return {"error": "api_error", "details": err_msg, "status": status_str}


def make_unified_prompt(ocr_text: str) -> str:
    from services.document_classifier import DOCUMENT_TYPES
    doc_types_desc = "\n".join([f"- {k}: {v['description']}" for k, v in DOCUMENT_TYPES.items()])
    
    prompt = f"""
You are an expert medical document analysis AI.
Analyze the following medical document OCR text and extract classification metadata and all clinical findings.

OCR Text:
{ocr_text}

=== TASK 1: Document Classification ===
Classify the document into exactly ONE of the following document types:
{doc_types_desc}

Provide a classification_reason (under 50 words) and classification_confidence (integer 0-100).
If the document is not a medical document (e.g. shopping receipt, random non-medical text), classify it as "not_medical_document" and mark "rejected": true.

=== TASK 2: Information Extraction ===
Based on the document type, extract all structured data. You must extract the general metadata:
- patient_name
- doctor_name (often under letterhead or signature)
- hospital (or clinic/center)
- date (often under prescription date, test date, issue date)

And extract the specific details based on the classified type:
- If the type is "prescription":
  - medicines: list of medications. For each, extract: name, dosage (e.g. 500mg), frequency (e.g. BD, TDS, once daily), duration (e.g. 5 days), food_instructions (e.g. after food), instructions.
  - diagnosis
  - symptoms
  - clinical_findings
  - advice
  - allergies
- If the type is "blood_report":
  - test_name
  - parameters: reference ranges, values (e.g., Hemoglobin 14.5 g/dL, marked as abnormal if out of range)
- If the type is "lab_report":
  - test_name
  - results: tests and values
- If the type is "radiology_report", "xray", "ct_scan", "mri", or "ultrasound_report":
  - findings: text description
  - impression: clinical conclusion
  - recommendation: follow-up direction
- If the type is "discharge_summary":
  - admission_date
  - discharge_date
  - diagnosis
  - procedures
  - medications: list of medications
  - follow_up
- If the type is "medical_certificate":
  - certificate_type
  - validity
  - condition
  - restrictions

=== RESPONSE FORMAT ===
Return ONLY valid JSON matching this schema:
{{
  "document_type": "type_name",
  "classification_confidence": 95,
  "classification_reason": "Contains letterhead and medicines",
  "rejected": false,
  "rejection_reason": null,
  
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "hospital": "string or null",
  "date": "string or null",
  
  "diagnosis": "string or null",
  "symptoms": ["string"],
  "clinical_findings": ["string"],
  "medicines": [
    {{
      "name": "string",
      "dosage": "string or null",
      "frequency": "string or null",
      "duration": "string or null",
      "food_instructions": "string or null",
      "instructions": "string or null"
    }}
  ],
  "advice": ["string"],
  "allergies": ["string"],
  
  "test_name": "string or null",
  "parameters": [
    {{
      "name": "string",
      "value": "string",
      "unit": "string or null",
      "reference_range": "string or null",
      "is_abnormal": false
    }}
  ],
  
  "results": [
    {{
      "test": "string",
      "result": "string",
      "unit": "string or null",
      "reference": "string or null"
    }}
  ],
  
  "findings": "string or null",
  "impression": "string or null",
  "recommendation": "string or null",
  
  "admission_date": "string or null",
  "discharge_date": "string or null",
  "procedures": ["string"],
  "medications": [
    {{
      "name": "string",
      "dosage": "string or null",
      "duration": "string or null"
    }}
  ],
  
  "certificate_type": "string or null",
  "validity": "string or null",
  "condition": "string or null",
  "restrictions": ["string"]
}}

CRITICAL RULES:
- Never hallucinate medical details.
- Provide a confidence_score (0-100) based on how clear and complete the text information is.
- Return ONLY the raw JSON string; no explanation, no markdown text block.
"""
    return prompt


def structure_medical_text(
    ocr_text: str | None,
    file_path: str | Path | None = None,
    is_digital: bool = False
) -> dict[str, Any]:
    """
    Production-grade Medical Document Understanding Pipeline.
    Unifies classification and extraction into a single backend/multimodal AI call,
    while utilizing local deterministic pre-analysis and Zero-AI paths.
    """
    start_time = time.time()
    source_text = str(ocr_text or "").strip()
    
    def log_info(msg: str):
        print(sanitize_log_message(msg))
        
    print("[AI] Request budget: 1")
    print("[AI] Deterministic pre-analysis started")
    
    if not source_text:
        return _empty_result()
        
    # Running OCR / Clean Text checks
    cleaned_text = OCRCleaner.clean(source_text)
    ocr_quality = OCRCleaner.calculate_ocr_quality(cleaned_text)
    
    # Deterministic Pre-analysis
    doc_type, heur_conf = classify_document_heuristic(cleaned_text)
    det_data = None
    try:
        det_data = deterministic_extraction(source_text, doc_type)
    except Exception as e:
        print(f"[AI] Deterministic extraction failed top-level: {e}")
        det_data = {
            "patient_name": "",
            "doctor_name": "",
            "hospital": "",
            "prescription_date": "",
            "medicines": []
        }
    
    # Grade deterministic confidence
    det_confidence = 0.0
    if det_data["patient_name"]: det_confidence += 25.0
    if det_data["doctor_name"]: det_confidence += 25.0
    if det_data["hospital"]: det_confidence += 25.0
    if det_data["medicines"]: det_confidence += 25.0
    
    print(f"[AI] Deterministic confidence: {det_confidence}")
    
    overall_local_confidence = (ocr_quality * 0.4) + (det_confidence * 0.6)
    
    # format target
    input_format = "digital" if (is_digital or (file_path and Path(file_path).suffix.lower() == ".pdf" and is_digital)) else "scanned"
    
    # Enforce request budgets
    ai_status = "AI_COMPLETED"
    gemini_required = True
    
    if input_format == "digital" and det_confidence >= 75.0:
        log_info(f"[AI PIPELINE] Bypassing Gemini (Zero-AI Path matched for digital document, det_confidence: {det_confidence:.1f}%)")
        gemini_required = False
        ai_status = "DETERMINISTIC_COMPLETED"
    elif ocr_quality >= 90.0 and overall_local_confidence >= 90.0:
        log_info(f"[AI PIPELINE] Bypassing Gemini (Zero-AI Path matched for high-confidence scanned document, local_conf: {overall_local_confidence:.1f}%)")
        gemini_required = False
        ai_status = "DETERMINISTIC_COMPLETED"
        
    print(f"[AI] Gemini required: {str(gemini_required).lower()}")
        
    extracted_data = None
    classification_confidence = heur_conf
    classification_reason = "Local keyword heuristic"
    gemini_called = False
    
    if gemini_required:
        if not GEMINI_API_KEY:
            print("[AI] Gemini configuration error: API key unavailable")
            log_info("[AI PIPELINE] GEMINI_API_KEY not configured. Falling back to deterministic.")
            ai_status = "AI_PROVIDER_UNAVAILABLE"
        else:
            gemini_called = True
            prompt = make_unified_prompt(cleaned_text)
            parts = [{"text": prompt}]
            if file_path:
                img_part = get_multimodal_parts(Path(file_path))
                if img_part:
                    parts.append(img_part)
                    log_info("[AI PIPELINE] Image part included for multimodal interpretation.")
                    
            payload = {
                "contents": [{"role": "user", "parts": parts}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json",
                },
            }
            
            gemini_response = execute_gemini_request_with_retry(payload)
            
            if gemini_response and "error" not in gemini_response:
                try:
                    candidates = gemini_response.get("candidates") or []
                    content = candidates[0].get("content", {}) if candidates else {}
                    rparts = content.get("parts") or []
                    text = "\n".join(
                        part.get("text", "")
                        for part in rparts
                        if isinstance(part, dict) and part.get("text")
                    )
                    extracted_data = _extract_json_object(text)
                    if extracted_data:
                        # Extract document type returned by Gemini
                        doc_type = extracted_data.get("document_type", doc_type).lower()
                        classification_confidence = extracted_data.get("classification_confidence", 80)
                        classification_reason = extracted_data.get("classification_reason", "Gemini classification")
                        log_info(f"[AI PIPELINE] Gemini Classified as: {doc_type} (conf: {classification_confidence}%)")
                    else:
                        log_info("[AI PIPELINE] Gemini returned data but JSON parsing failed.")
                        ai_status = "AI_PARSE_ERROR"
                except Exception as ex:
                    log_info(f"[AI PIPELINE] Failed to parse unified Gemini response: {ex}")
                    ai_status = "AI_PARSE_ERROR"
            else:
                err_code = gemini_response.get("error") if gemini_response else "unknown"
                log_info(f"[AI PIPELINE] Unified Gemini query failed: {err_code}. Triggering deterministic fallback.")
                ai_status = "AI_PROVIDER_UNAVAILABLE"
                
    if not extracted_data:
        log_info("[AI PIPELINE] Fallback to deterministic local extraction fields.")
        if ai_status == "AI_COMPLETED" and gemini_called:
            ai_status = "AI_PARSE_ERROR"
            
        extracted_data = {
            "doctor_name": det_data["doctor_name"],
            "hospital": det_data["hospital"],
            "patient_name": det_data["patient_name"],
            "prescription_date": det_data["prescription_date"],
            "medicines": det_data["medicines"],
            "diagnosis": "",
            "symptoms": [],
            "clinical_findings": [],
            "advice": [],
            "notes": [],
            "rejected": False,
            "rejection_reason": ""
        }
    else:
        # Safe merge with deterministic data for missing fields
        log_info("[AI PIPELINE] Safely merging deterministic extraction into Gemini results.")
        if not extracted_data.get("doctor_name") and det_data["doctor_name"]:
            extracted_data["doctor_name"] = det_data["doctor_name"]
        if not extracted_data.get("hospital") and det_data["hospital"]:
            extracted_data["hospital"] = det_data["hospital"]
        if not extracted_data.get("patient_name") and det_data["patient_name"]:
            extracted_data["patient_name"] = det_data["patient_name"]
        if not extracted_data.get("date") and det_data["prescription_date"]:
            extracted_data["date"] = det_data["prescription_date"]
        
        # Merge medicines additively if deterministic found extras
        if det_data.get("medicines"):
            gem_meds = extracted_data.get("medicines") or []
            seen_gem = {str(m.get("name", "")).lower() for m in gem_meds}
            for det_med in det_data["medicines"]:
                if str(det_med.get("name", "")).lower() not in seen_gem:
                    gem_meds.append(det_med)
            extracted_data["medicines"] = gem_meds
        
    # Reject non-medical early
    if doc_type == "not_medical_document" or extracted_data.get("rejected", False):
        rejection_reason = extracted_data.get("rejection_reason") or "Document classified as non-medical"
        log_info(f"[AI PIPELINE] REJECTED: {rejection_reason}")
        return {
            **_empty_result(cleaned_text),
            "document_type": "not_medical_document",
            "classification": "non-medical",
            "confidence_score": 0.0,
            "processing_time": time.time() - start_time,
            "ocr_quality_score": ocr_quality,
            "rejected": True,
            "rejection_reason": rejection_reason,
            "ai_status": ai_status
        }
        
    # Schema validation
    schema_valid, schema_errors = validate_schema(doc_type, extracted_data)
    
    # Medicine extraction post-processing
    if should_extract_medicines(doc_type):
        gemini_medicines = extracted_data.get("medicines", [])
        regex_medicines = MedicineExtractor.extract_medicines(cleaned_text, doc_type)
        seen_names = {m.get("name", "").lower() for m in gemini_medicines if m.get("name")}
        for regex_med in regex_medicines:
            if regex_med["name"].lower() not in seen_names:
                gemini_medicines.append(regex_med)
                seen_names.add(regex_med["name"].lower())
        extracted_data["medicines"] = gemini_medicines
    else:
        extracted_data["medicines"] = []
        
    # Validation step
    if should_extract_medicines(doc_type):
        allergies = extracted_data.get("allergies", [])
        verified_meds, unverified_meds, suspicious_meds, med_conf = MedicationValidator.validate_medicines(
            extracted_data.get("medicines", []), allergies
        )
        extracted_data["verified_medicines"] = verified_meds
        extracted_data["unverified_medicines"] = unverified_meds
        # Preserve ALL medicines (verified + unverified) in the main list
        # Filter out duplicates if any overlap
        all_meds = verified_meds + unverified_meds
        extracted_data["medicines"] = all_meds
        extracted_data["suspicious_medicines"] = suspicious_meds
        medicine_confidence = med_conf
    else:
        extracted_data["verified_medicines"] = []
        extracted_data["unverified_medicines"] = []
        extracted_data["medicines"] = []
        extracted_data["suspicious_medicines"] = []
        medicine_confidence = 100.0
        
    # Normalize diagnosis conditions
    diagnosis = extracted_data.get("diagnosis", "")
    if diagnosis:
        normalized_diagnosis = ConditionNormalizer.normalize(diagnosis)
        extracted_data["diagnosis"] = normalized_diagnosis
        
    # Calculate confidence score
    processing_time = time.time() - start_time
    confidence_scores = ConfidenceCalculator.calculate_comprehensive_confidence(
        ocr_text=source_text,
        cleaned_text=cleaned_text,
        document_type=doc_type,
        classification_confidence=classification_confidence,
        extracted_data=extracted_data,
        ocr_quality=ocr_quality,
        schema_valid=schema_valid,
        processing_time=processing_time
    )
    confidence_score = confidence_scores["overall_confidence"]
    
    # Quality validation
    is_valid, validation_errors, should_recover = QualityValidator.validate_extraction(
        document_type=doc_type,
        extracted_data=extracted_data,
        ocr_text=source_text,
        confidence_score=confidence_score
    )
    
    if not is_valid:
        if QualityValidator.should_reject_document(doc_type, confidence_score, validation_errors):
            log_info(f"[AI PIPELINE] REJECTED: Failed quality validation: {validation_errors}")
            return {
                **_empty_result(cleaned_text),
                "document_type": doc_type,
                "classification": doc_type,
                "confidence_score": confidence_score,
                "processing_time": processing_time,
                "ocr_quality_score": ocr_quality,
                "rejected": True,
                "rejection_reason": ", ".join(validation_errors),
                "ai_status": ai_status
            }
        if should_recover:
            extracted_data = QualityValidator.attempt_recovery(doc_type, extracted_data, source_text)
            
    # AI Summary
    ai_summary = AISummaryGenerator.generate_summary(
        document_type=doc_type,
        extracted_data=extracted_data,
        medicines=extracted_data.get("medicines", []),
        conditions=[extracted_data.get("diagnosis", "")] if extracted_data.get("diagnosis") else [],
        doctor_name=extracted_data.get("doctor_name", ""),
        hospital=extracted_data.get("hospital", ""),
        ai_status=ai_status
    )
    
    # Document title
    findings = extracted_data.get("findings", "")
    document_title = TitleGenerator.generate_title(doc_type, extracted_data.get("diagnosis", ""), findings)
    
    # Normalize result
    normalized_result = _normalize_to_legacy_format(
        extracted_data,
        doc_type,
        cleaned_text,
        confidence_score,
        processing_time,
        ocr_quality,
        classification_confidence,
        classification_reason,
        schema_valid,
        validation_errors
    )
    
    normalized_result["ai_summary"] = ai_summary
    normalized_result["document_title"] = document_title
    normalized_result["component_confidence"] = confidence_scores
    normalized_result["ai_status"] = ai_status
    
    return normalized_result
