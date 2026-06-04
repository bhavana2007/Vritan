import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

OCR_API_URL = "https://api.ocr.space/parse/image"
OCR_API_KEY = os.getenv("OCR_SPACE_API_KEY")


def clean_ocr_text(text: str | None) -> str:
    """Normalize common OCR spacing and line-break artifacts."""
    if not text:
        return ""

    cleaned = str(text).replace("\r", "\n")
    cleaned = re.sub(r"[|]{2,}", " ", cleaned)
    cleaned = re.sub(r"[_~`]+", " ", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r" *\n *", "\n", cleaned)
    cleaned = re.sub(r"(?m)^\s*[-:.,]{1,3}\s*$", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"([A-Za-z])-\n([A-Za-z])", r"\1\2", cleaned)
    return cleaned.strip()


def extract_text_from_file(file_path: str | Path) -> str:
    if not OCR_API_KEY:
        return ""

    path = Path(file_path)
    if not path.exists():
        return ""

    try:
        with path.open("rb") as file_handle:
            response = requests.post(
                OCR_API_URL,
                files={"file": (path.name, file_handle)},
                data={
                    "apikey": OCR_API_KEY,
                    "language": "eng",
                    "OCREngine": 3,
                },
                timeout=60,
            )
        response.raise_for_status()
        result = response.json()
    except (requests.RequestException, ValueError):
        return ""

    if result.get("IsErroredOnProcessing"):
        return ""

    parsed_results = result.get("ParsedResults") or []
    parsed_text = "\n\n".join(
        item.get("ParsedText", "")
        for item in parsed_results
        if isinstance(item, dict)
    )
    return clean_ocr_text(parsed_text)
