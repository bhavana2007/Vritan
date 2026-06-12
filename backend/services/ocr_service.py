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
    print(f"OCR STARTED")
    print(f"OCR API KEY loaded: {bool(OCR_API_KEY)}")
    
    if not OCR_API_KEY:
        print(f"OCR ERROR: API key not found")
        return ""

    path = Path(file_path)
    print(f"OCR FILE PATH: {path}")
    print(f"OCR FILE EXISTS: {path.exists()}")
    
    if not path.exists():
        print(f"OCR ERROR: File does not exist at {path}")
        return ""

    try:
        print(f"OCR REQUEST STARTED to {OCR_API_URL}")
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
        print(f"OCR RESPONSE STATUS: {response.status_code}")
        response.raise_for_status()
        result = response.json()
        print(f"OCR RESPONSE BODY: {result}")
    except requests.RequestException as e:
        print(f"OCR ERROR: RequestException - {e}")
        return ""
    except ValueError as e:
        print(f"OCR ERROR: ValueError (JSON decode) - {e}")
        return ""

    if result.get("IsErroredOnProcessing"):
        error_message = result.get("ErrorMessage", "Unknown OCR processing error")
        print(f"OCR ERROR: Processing failed - {error_message}")
        return ""

    parsed_results = result.get("ParsedResults") or []
    print(f"OCR PARSED RESULTS COUNT: {len(parsed_results)}")
    
    parsed_text = "\n\n".join(
        item.get("ParsedText", "")
        for item in parsed_results
        if isinstance(item, dict)
    )
    
    cleaned = clean_ocr_text(parsed_text)
    print(f"OCR TEXT LENGTH: {len(cleaned)}")
    print(f"OCR DONE")
    
    return cleaned
