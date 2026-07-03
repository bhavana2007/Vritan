import os
import re
from pathlib import Path
from typing import Literal

import requests
from dotenv import load_dotenv
from PIL import Image


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

OCR_API_URL = "https://api.ocr.space/parse/image"
OCR_API_KEY = os.getenv("OCR_SPACE_API_KEY")


class OCRError(Exception):
    """Base exception for OCR failures."""
    def __init__(self, message: str, error_type: Literal["api_error", "timeout", "network", "payload_too_large", "processing_error"]):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


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


def compress_image(file_path: str | Path) -> Path:
    """Compress image to meet OCR.Space limits while maintaining text readability.
    
    Target specs:
    - Max width: 1500px
    - JPEG quality: 80-85%
    
    Returns path to compressed image (may be original if no compression needed).
    """
    path = Path(file_path)
    
    # Only compress images, not PDFs
    if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        print(f"[COMPRESSION] Skipping non-image file: {path.suffix}")
        return path
    
    try:
        with Image.open(path) as img:
            original_width, original_height = img.size
            print(f"[COMPRESSION] Original size: {original_width}x{original_height}")
            
            # Check if compression is needed
            needs_compression = False
            
            # Resize if width exceeds 1500px
            if original_width > 1500:
                needs_compression = True
                new_width = 1500
                new_height = int(original_height * (1500 / original_width))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                print(f"[COMPRESSION] Resized to: {new_width}x{new_height}")
            
            # Convert to RGB if necessary (for JPEG)
            if img.mode in ("RGBA", "P"):
                needs_compression = True
                img = img.convert("RGB")
                print(f"[COMPRESSION] Converted to RGB")
            
            # If no compression needed, return original
            if not needs_compression:
                print(f"[COMPRESSION] No compression needed")
                return path
            
            # Save compressed version
            compressed_path = path.parent / f"{path.stem}_compressed{path.suffix}"
            img.save(compressed_path, "JPEG", quality=85, optimize=True)
            
            # Check file size reduction
            original_size = path.stat().st_size
            compressed_size = compressed_path.stat().st_size
            reduction = (1 - compressed_size / original_size) * 100
            print(f"[COMPRESSION] Original size: {original_size / 1024:.1f} KB")
            print(f"[COMPRESSION] Compressed size: {compressed_size / 1024:.1f} KB")
            print(f"[COMPRESSION] Reduction: {reduction:.1f}%")
            print(f"[COMPRESSION] COMPRESSION APPLIED")
            
            return compressed_path
            
    except Exception as e:
        print(f"[COMPRESSION] ERROR: {e}")
        # If compression fails, return original path
        print(f"[COMPRESSION] Using original file")
        return path


def extract_text_from_file(file_path: str | Path) -> str:
    import time
    start_time = time.time()
    print(f"[OCR] OCR STARTED")
    print(f"[OCR] API KEY loaded: {bool(OCR_API_KEY)}")
    
    if not OCR_API_KEY:
        print(f"[OCR] ERROR: API key not found")
        raise OCRError("OCR service is not configured properly", "api_error")

    path = Path(file_path)
    print(f"[OCR] FILE PATH: {path}")
    print(f"[OCR] FILE EXISTS: {path.exists()}")
    
    if not path.exists():
        print(f"[OCR] ERROR: File does not exist at {path}")
        raise OCRError("Uploaded file not found", "network")
    
    try:
        print(f"[OCR] REQUEST STARTED to {OCR_API_URL}")
        with path.open("rb") as file_handle:
            response = requests.post(
                OCR_API_URL,
                files={"file": (path.name, file_handle)},
                data={
                    "apikey": OCR_API_KEY,
                    "language": "eng",
                    "OCREngine": 2,  # Use engine 2 for better multilingual support
                },
                timeout=60,
            )
        print(f"[OCR] RESPONSE STATUS: {response.status_code}")
        
        # Handle HTTP 413 Payload Too Large
        if response.status_code == 413:
            raise OCRError("Image too large. Please upload a smaller image.", "payload_too_large")
        
        response.raise_for_status()
        result = response.json()
        print(f"[OCR] RESPONSE RECEIVED")
        
    except requests.Timeout as e:
        print(f"[OCR] ERROR: Timeout - {e}")
        raise OCRError("OCR service timed out. Please try again.", "timeout")
    except requests.ConnectionError as e:
        print(f"[OCR] ERROR: Connection error - {e}")
        raise OCRError("Network error connecting to OCR service.", "network")
    except requests.HTTPError as e:
        print(f"[OCR] ERROR: HTTP error - {e}")
        if e.response.status_code >= 500:
            raise OCRError("OCR service temporarily unavailable.", "api_error")
        raise OCRError(f"OCR service error: {str(e)}", "api_error")
    except requests.RequestException as e:
        print(f"[OCR] ERROR: RequestException - {e}")
        raise OCRError("Failed to process image with OCR service.", "network")
    except ValueError as e:
        print(f"[OCR] ERROR: JSON decode error - {e}")
        raise OCRError("OCR service returned invalid response.", "api_error")

    if result.get("IsErroredOnProcessing"):
        error_message = result.get("ErrorMessage", "Unknown OCR processing error")
        print(f"[OCR] ERROR: Processing failed - {error_message}")
        raise OCRError(f"OCR processing failed: {error_message}", "processing_error")

    parsed_results = result.get("ParsedResults") or []
    print(f"[OCR] PARSED RESULTS COUNT: {len(parsed_results)}")
    
    if not parsed_results:
        print(f"[OCR] ERROR: No parsed results returned")
        raise OCRError("OCR service could not extract text from image.", "processing_error")
    
    parsed_text = "\n\n".join(
        item.get("ParsedText", "")
        for item in parsed_results
        if isinstance(item, dict)
    )
    
    cleaned = clean_ocr_text(parsed_text)
    elapsed_time = time.time() - start_time
    print(f"[OCR] TEXT LENGTH: {len(cleaned)}")
    print(f"[OCR] OCR SUCCESS (took {elapsed_time:.2f}s)")
    
    return cleaned
