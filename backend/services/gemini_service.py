import json
import os
import re
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


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
}


def _empty_result(cleaned_text: str = "") -> dict[str, Any]:
    result = dict(EMPTY_MEDICAL_INTELLIGENCE)
    result["cleaned_text"] = cleaned_text.strip()
    return result


def _extract_json_object(value: str) -> dict[str, Any] | None:
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


def _normalize_result(parsed: dict[str, Any], fallback_text: str) -> dict[str, Any]:
    cleaned_text = str(parsed.get("cleaned_text") or fallback_text or "").strip()
    classification = str(parsed.get("classification") or "unknown").strip().lower()
    allowed_classifications = {
        "prescription",
        "medical report",
        "scan",
        "non-medical",
        "unknown",
    }
    if classification not in allowed_classifications:
        classification = "unknown"
    return {
        "cleaned_text": cleaned_text,
        "medicines": _normalize_medicines(parsed.get("medicines")),
        "possible_conditions": _normalize_possible_conditions(
            parsed.get("possible_conditions")
        ),
        "doctor_or_hospital": str(parsed.get("doctor_or_hospital") or "").strip(),
        "advice": _normalize_string_list(parsed.get("advice")),
        "notes": _normalize_string_list(parsed.get("notes")),
        "classification": classification,
    }


def structure_medical_text(ocr_text: str | None) -> dict[str, Any]:
    source_text = str(ocr_text or "").strip()
    if not source_text:
        return _empty_result()
    if not GEMINI_API_KEY:
        return _empty_result(source_text)

    prompt = f"""
You are helping organize patient-uploaded medical documents for search.
Correct obvious OCR spelling and formatting mistakes, detect medicines, dosage,
duration, doctor or hospital, useful advice, notes, possible related conditions,
and whether the document is medically relevant.

Never produce a diagnosis or confirmed disease. Conditions must be phrased as
"Possible related condition: ...". If uncertain, return an empty array.

Classify the document as exactly one of:
"prescription", "medical report", "scan", "non-medical", or "unknown".
Use "non-medical" only when the OCR text clearly does not describe a medical
prescription, scan, lab report, or medical document.

Return only valid JSON with this exact shape:
{{
  "cleaned_text": "corrected readable OCR text",
  "classification": "prescription",
  "doctor_or_hospital": "doctor, clinic, hospital, or lab name if present",
  "medicines": [
    {{"name": "medicine name", "dosage": "dosage if present", "duration": "duration if present"}}
  ],
  "possible_conditions": ["Possible related condition: condition"],
  "advice": ["medical advice or instructions, not diagnosis"],
  "notes": ["brief note"]
}}

OCR text:
{source_text}
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
        return _empty_result(source_text)

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
        return _empty_result(source_text)
    return _normalize_result(parsed, source_text)
