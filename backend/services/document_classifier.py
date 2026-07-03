"""
Medical Document Classification System
Classifies medical documents into 16 categories with confidence scoring
"""

import json
import os
import re
from typing import Any
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# Document type definitions
DOCUMENT_TYPES = {
    "prescription": {
        "icon": "💊",
        "display_name": "Prescription",
        "extract_medicines": True,
        "description": "Doctor's prescription with medications"
    },
    "blood_report": {
        "icon": "🩸",
        "display_name": "Blood Report",
        "extract_medicines": False,
        "description": "Blood test results (CBC, sugar, thyroid, etc.)"
    },
    "lab_report": {
        "icon": "🔬",
        "display_name": "Lab Report",
        "extract_medicines": False,
        "description": "Laboratory test results"
    },
    "radiology_report": {
        "icon": "🩻",
        "display_name": "Radiology Report",
        "extract_medicines": False,
        "description": "X-Ray, CT, MRI radiology reports"
    },
    "mri": {
        "icon": "🧠",
        "display_name": "MRI",
        "extract_medicines": False,
        "description": "MRI scan report"
    },
    "ct_scan": {
        "icon": "🫀",
        "display_name": "CT Scan",
        "extract_medicines": False,
        "description": "CT scan report"
    },
    "xray": {
        "icon": "🦴",
        "display_name": "X-Ray",
        "extract_medicines": False,
        "description": "X-Ray report"
    },
    "vaccination_record": {
        "icon": "💉",
        "display_name": "Vaccination Record",
        "extract_medicines": False,
        "description": "Vaccination history"
    },
    "discharge_summary": {
        "icon": "🏥",
        "display_name": "Discharge Summary",
        "extract_medicines": True,
        "description": "Hospital discharge summary"
    },
    "medical_certificate": {
        "icon": "📄",
        "display_name": "Medical Certificate",
        "extract_medicines": False,
        "description": "Medical fitness certificate"
    },
    "hospital_bill": {
        "icon": "🧾",
        "display_name": "Hospital Bill",
        "extract_medicines": False,
        "description": "Hospital invoice/bill"
    },
    "insurance_document": {
        "icon": "🛡️",
        "display_name": "Insurance Document",
        "extract_medicines": False,
        "description": "Insurance claim or policy document"
    },
    "referral_letter": {
        "icon": "✉️",
        "display_name": "Referral Letter",
        "extract_medicines": False,
        "description": "Doctor referral letter"
    },
    "ecg_report": {
        "icon": "❤️",
        "display_name": "ECG Report",
        "extract_medicines": False,
        "description": "Electrocardiogram report"
    },
    "ultrasound_report": {
        "icon": "🔊",
        "display_name": "Ultrasound Report",
        "extract_medicines": False,
        "description": "Ultrasound scan report"
    },
    "general_medical_report": {
        "icon": "📋",
        "display_name": "Medical Report",
        "extract_medicines": False,
        "description": "General medical report"
    },
    "other_medical_document": {
        "icon": "📁",
        "display_name": "Other Medical Document",
        "extract_medicines": False,
        "description": "Other medical document"
    },
    "not_medical_document": {
        "icon": "❌",
        "display_name": "Not Medical",
        "extract_medicines": False,
        "description": "Non-medical document"
    }
}

# Keywords for each document type (for initial heuristic classification)
DOCUMENT_KEYWORDS = {
    "prescription": [
        "rx", "prescription", "tab", "tablet", "cap", "capsule", "syp", "syrup",
        "inj", "injection", "dosage", "mg", "take", "after food", "before food",
        "bd", "tds", "sos", "od", "medicine", "medication"
    ],
    "blood_report": [
        "hemoglobin", "rbc", "wbc", "platelet", "blood count", "cbc", "sugar",
        "glucose", "hba1c", "creatinine", "thyroid", "tsh", "t3", "t4", "cholesterol",
        "lipid profile", "blood group", "hematology"
    ],
    "lab_report": [
        "laboratory", "lab report", "test result", "specimen", "sample",
        "reference range", "urine", "stool", "culture", "sensitivity"
    ],
    "radiology_report": [
        "radiology", "x-ray", "chest", "findings", "impression", "radiologist",
        "pa view", "ap view", "lateral view"
    ],
    "mri": [
        "mri", "magnetic resonance", "t1", "t2", "flair", "diffusion", "sequence",
        "axial", "coronal", "sagittal"
    ],
    "ct_scan": [
        "ct", "computed tomography", "contrast", "non-contrast", "helical",
        "slice", "hounsfield"
    ],
    "xray": [
        "x-ray", "radiograph", "bone", "fracture", "opacity", "lung field",
        "cardiac silhouette"
    ],
    "vaccination_record": [
        "vaccine", "vaccination", "immunization", "dose", "booster", "bcg",
        "polio", "mmr", "hepatitis", "covid", "dpt"
    ],
    "discharge_summary": [
        "discharge summary", "admission", "discharge", "hospital course",
        "disposition", "follow up", "inpatient", "ward"
    ],
    "medical_certificate": [
        "medical certificate", "fitness certificate", "medical fitness",
        "certify that", "fit to work", "unfit", "medical leave"
    ],
    "hospital_bill": [
        "invoice", "bill", "amount", "total", "payment", "receipt", "charges",
        "hospital charges", "room rent", "medicine charges"
    ],
    "insurance_document": [
        "insurance", "claim", "policy", "coverage", "insured", "beneficiary",
        "tpa", "cashless", "reimbursement"
    ],
    "referral_letter": [
        "referral", "referred to", "please examine", "consult", "specialist",
        "opinion sought"
    ],
    "ecg_report": [
        "ecg", "electrocardiogram", "sinus rhythm", "st segment", "t wave",
        "qrs complex", "pr interval", "heart rate", "lead"
    ],
    "ultrasound_report": [
        "ultrasound", "sonography", "usg", "echogenicity", "cyst", "mass",
        "organ", "uterus", "ovary", "prostate", "gall bladder"
    ],
    "general_medical_report": [
        "medical report", "clinical", "examination", "diagnosis", "history",
        "symptoms", "patient", "doctor"
    ]
}


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


def classify_document_heuristic(ocr_text: str) -> tuple[str, float]:
    """
    Fast heuristic classification using keyword matching.
    Returns (document_type, confidence_score)
    """
    text_lower = ocr_text.lower()
    scores = {}

    for doc_type, keywords in DOCUMENT_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in text_lower:
                score += 1
        scores[doc_type] = score

    # Find the highest scoring document type
    max_score = max(scores.values())
    if max_score == 0:
        return "general_medical_report", 30.0

    best_type = max(scores, key=scores.get)
    confidence = min(90.0, (max_score / len(DOCUMENT_KEYWORDS[best_type])) * 100)

    return best_type, confidence


def classify_document_gemini(ocr_text: str) -> dict[str, Any]:
    """
    Use Gemini to classify the document with high accuracy.
    Returns classification with confidence and reasoning.
    """
    if not GEMINI_API_KEY:
        # Fallback to heuristic if API key not available
        doc_type, confidence = classify_document_heuristic(ocr_text)
        return {
            "document_type": doc_type,
            "confidence": confidence,
            "reasoning": "API key not available, used heuristic classification"
        }

    prompt = f"""
You are a medical document classification expert. Analyze the OCR text and classify the document.

OCR Text:
{ocr_text}

Classify into ONE of these categories:
- prescription: Doctor's prescription with medications
- blood_report: Blood test results (CBC, sugar, thyroid, etc.)
- lab_report: Laboratory test results
- radiology_report: X-Ray, CT, MRI radiology reports
- mri: MRI scan report
- ct_scan: CT scan report
- xray: X-Ray report
- vaccination_record: Vaccination history
- discharge_summary: Hospital discharge summary
- medical_certificate: Medical fitness certificate
- hospital_bill: Hospital invoice/bill
- insurance_document: Insurance claim or policy document
- referral_letter: Doctor referral letter
- ecg_report: Electrocardiogram report
- ultrasound_report: Ultrasound scan report
- general_medical_report: General medical report
- other_medical_document: Other medical document
- not_medical_document: Non-medical document (receipts, random text, etc.)

Return ONLY valid JSON with this exact shape:
{{
  "document_type": "prescription",
  "confidence": 95,
  "reasoning": "Contains Rx symbol, multiple medicine names with dosages"
}}

Rules:
- document_type: Must be exactly one of the categories listed above
- confidence: Integer 0-100 representing classification confidence
- reasoning: Brief explanation (max 100 words) for the classification
- If the document is clearly not medical (e.g., shopping receipt, random text), classify as "not_medical_document"
- Be conservative with confidence - if uncertain, use lower confidence
"""

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
    except (requests.RequestException, ValueError) as e:
        print(f"[CLASSIFIER] Gemini API error: {e}")
        # Fallback to heuristic
        doc_type, confidence = classify_document_heuristic(ocr_text)
        return {
            "document_type": doc_type,
            "confidence": confidence,
            "reasoning": "Gemini API failed, used heuristic classification"
        }

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
        print(f"[CLASSIFIER] Failed to parse Gemini response")
        doc_type, confidence = classify_document_heuristic(ocr_text)
        return {
            "document_type": doc_type,
            "confidence": confidence,
            "reasoning": "Gemini parsing failed, used heuristic classification"
        }

    # Validate document type
    doc_type = parsed.get("document_type", "").lower()
    if doc_type not in DOCUMENT_TYPES:
        doc_type = "general_medical_report"

    return {
        "document_type": doc_type,
        "confidence": parsed.get("confidence", 50),
        "reasoning": parsed.get("reasoning", "Gemini classification")
    }


def get_document_type_info(document_type: str) -> dict[str, Any]:
    """Get metadata for a document type."""
    return DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["general_medical_report"])


def should_extract_medicines(document_type: str) -> bool:
    """Determine if medicines should be extracted for this document type."""
    info = get_document_type_info(document_type)
    return info.get("extract_medicines", False)
