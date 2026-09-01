import os
import re
import time
from pathlib import Path
from typing import Literal

import requests
import cv2
import numpy as np
from pdf2image import convert_from_path
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


def deskew_image(image):
    """Deskew / tilt correction using OpenCV."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(gray > 0))
    angle = cv2.minAreaRect(coords)[-1]
    
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
        
    if abs(angle) < 0.5:
        return image
        
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated


def preprocess_image_cv2(file_path: Path) -> Path:
    """OpenCV preprocessing: grayscale, deskew, denoise, contrast."""
    if file_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return file_path
        
    try:
        print(f"[PREPROCESS] Starting OpenCV enhancement for {file_path}")
        image = cv2.imread(str(file_path))
        if image is None:
            return file_path
            
        # 1. Deskew
        image = deskew_image(image)
        
        # 2. Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 3. Denoise
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        
        # 4. Adaptive Thresholding for contrast
        # Using a slight blur first
        blurred = cv2.GaussianBlur(denoised, (5, 5), 0)
        enhanced = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        
        preprocessed_path = file_path.parent / f"{file_path.stem}_cv2{file_path.suffix}"
        cv2.imwrite(str(preprocessed_path), enhanced)
        print(f"[PREPROCESS] OpenCV enhancement completed: {preprocessed_path}")
        return preprocessed_path
    except Exception as e:
        print(f"[PREPROCESS] OpenCV error: {e}")
        return file_path


def compress_image(file_path: Path) -> Path:
    """Compress image to meet OCR.Space limits while maintaining text readability."""
    if file_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return file_path
    
    try:
        with Image.open(file_path) as img:
            original_width, original_height = img.size
            needs_compression = False
            
            if original_width > 1500:
                needs_compression = True
                new_width = 1500
                new_height = int(original_height * (1500 / original_width))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            if img.mode in ("RGBA", "P"):
                needs_compression = True
                img = img.convert("RGB")
            
            if not needs_compression:
                return file_path
            
            compressed_path = file_path.parent / f"{file_path.stem}_comp{file_path.suffix}"
            img.save(compressed_path, "JPEG", quality=85, optimize=True)
            return compressed_path
    except Exception as e:
        print(f"[COMPRESSION] ERROR: {e}")
        return file_path


def _call_ocr_api(path: Path) -> str:
    """Internal function to call OCR.Space API for a single image."""
    try:
        with path.open("rb") as file_handle:
            response = requests.post(
                OCR_API_URL,
                files={"file": (path.name, file_handle)},
                data={
                    "apikey": OCR_API_KEY,
                    "language": "eng",
                    "OCREngine": 2,
                },
                timeout=60,
            )
        
        if response.status_code == 413:
            raise OCRError("Image too large. Please upload a smaller image.", "payload_too_large")
        
        response.raise_for_status()
        result = response.json()
        
        if result.get("IsErroredOnProcessing"):
            error_message = result.get("ErrorMessage", "Unknown OCR processing error")
            raise OCRError(f"OCR processing failed: {error_message}", "processing_error")

        parsed_results = result.get("ParsedResults") or []
        if not parsed_results:
            return ""
            
        return "\n\n".join(item.get("ParsedText", "") for item in parsed_results if isinstance(item, dict))
        
    except requests.Timeout as e:
        raise OCRError("OCR service timed out. Please try again.", "timeout")
    except requests.ConnectionError as e:
        raise OCRError("Network error connecting to OCR service.", "network")
    except requests.HTTPError as e:
        if e.response.status_code >= 500:
            raise OCRError("OCR service temporarily unavailable.", "api_error")
        raise OCRError(f"OCR service error: {str(e)}", "api_error")
    except requests.RequestException as e:
        raise OCRError("Failed to process image with OCR service.", "network")
    except ValueError as e:
        raise OCRError("OCR service returned invalid response.", "api_error")


def extract_native_text_from_pdf(pdf_path: Path) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text() or ""
        return text.strip()
    except Exception as e:
        print(f"[OCR] PyMuPDF native text extraction failed: {e}")
        try:
            from pypdf import PdfReader
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text.strip()
        except Exception as e2:
            print(f"[OCR] pypdf native text extraction failed: {e2}")
            return ""


def extract_text_from_file(file_path: str | Path) -> str:
    start_time = time.time()
    path = Path(file_path)
    if not path.exists():
        raise OCRError("Uploaded file not found", "network")
        
    # Check if PDF contains selectable native text first
    if path.suffix.lower() == ".pdf":
        print(f"[OCR] Checking if PDF has native/selectable text...")
        native_text = extract_native_text_from_pdf(path)
        if len(native_text.strip()) > 30:  # Has enough selectable text
            print(f"[OCR] Native PDF text found, bypassing OCR API.")
            return clean_ocr_text(native_text)

    if not OCR_API_KEY:
        raise OCRError("OCR service is not configured properly", "api_error")

    parsed_text = ""

    # Split PDF into images locally
    if path.suffix.lower() == ".pdf":
        print(f"[OCR] Processing PDF...")
        try:
            import shutil
            # 1. Detect whether Poppler exists
            if shutil.which("pdftoppm") is None and shutil.which("pdfinfo") is None:
                print("[OCR] Poppler dependency not found. Falling back to direct PDF upload.")
                # 2 & 3. Try OCR directly on the document
                parsed_text = _call_ocr_api(path)
            else:
                pages = convert_from_path(str(path), dpi=200)
                for i, page in enumerate(pages):
                    page_path = path.parent / f"{path.stem}_page_{i}.jpg"
                    page.save(page_path, "JPEG")
                    
                    print(f"[OCR] Processing page {i+1}/{len(pages)}")
                    processed = preprocess_image_cv2(page_path)
                    compressed = compress_image(processed)
                    page_text = _call_ocr_api(compressed)
                    parsed_text += f"\n\n--- Page {i+1} ---\n\n" + page_text
                    
        except Exception as e:
            # 6. Log detailed exceptions only in backend
            print(f"[OCR] PDF splitting failed: {e}")
            try:
                print("[OCR] Trying fallback: direct OCR on PDF...")
                parsed_text = _call_ocr_api(path)
            except Exception as e_fallback:
                print(f"[OCR] Fallback OCR failed: {e_fallback}")
                # 4 & 5. Inform frontend without exposing internal dependencies
                raise OCRError("Unable to process this document.", "processing_error")
    else:
        # Standard image pipeline
        processed = preprocess_image_cv2(path)
        compressed = compress_image(processed)
        parsed_text = _call_ocr_api(compressed)

    if not parsed_text.strip():
        raise OCRError("OCR service could not extract text from image.", "processing_error")

    cleaned = clean_ocr_text(parsed_text)
    elapsed_time = time.time() - start_time
    print(f"[OCR] SUCCESS (took {elapsed_time:.2f}s, length: {len(cleaned)})")
    
    return cleaned
