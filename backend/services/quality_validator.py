"""
Quality Validation Module
Validates AI outputs and rejects poor quality extractions
"""

import json
import re
from typing import Dict, Any, Tuple, List


class QualityValidator:
    """Validates AI extraction quality and attempts recovery."""

    # Impossible medicine names (clearly not medicines)
    IMPOSSIBLE_MEDICINES = {
        'heart', 'lungs', 'abdomen', 'stomach', 'chest', 'thorax', 'spine',
        'physical', 'examination', 'temperature', 'pulse', 'weight', 'height',
        'blood pressure', 'bp', 'normal', 'abnormal', 'present', 'absent',
        'positive', 'negative', 'clear', 'regular', 'irregular', 'rhythm',
        'rate', 'sound', 'murmur', 'finding', 'impression', 'recommendation',
        'follow', 'up', 'advice', 'note', 'date', 'time', 'signature'
    }

    # Minimum required fields for each document type
    # Relaxed to allow Gemini to be primary source of truth
    MINIMUM_REQUIREMENTS = {
        "prescription": {},  # No strict requirements
        "blood_report": {},
        "lab_report": {},
        "radiology_report": {},
        "mri": {},
        "ct_scan": {},
        "xray": {},
        "vaccination_record": {},
        "discharge_summary": {},
        "medical_certificate": {},
        "hospital_bill": {},
        "insurance_document": {},
        "referral_letter": {},
        "ecg_report": {},
        "ultrasound_report": {},
        "general_medical_report": {},
        "other_medical_document": {}
    }

    @staticmethod
    def validate_extraction(
        document_type: str,
        extracted_data: Dict[str, Any],
        ocr_text: str,
        confidence_score: float
    ) -> Tuple[bool, List[str], bool]:
        """
        Validate extraction quality.
        
        Args:
            document_type: Type of document
            extracted_data: Data extracted by AI
            ocr_text: Original OCR text
            confidence_score: Calculated confidence score
            
        Returns:
            (is_valid, list_of_errors, should_attempt_recovery)
        """
        errors = []

        # Check 1: JSON validity
        if not isinstance(extracted_data, dict):
            errors.append("Invalid JSON structure")
            return False, errors, False

        # Check 2: Non-medical document rejection
        if document_type == "not_medical_document":
            errors.append("Document classified as non-medical")
            return False, errors, False

        # Check 3: Minimum requirements
        min_req_errors = QualityValidator._check_minimum_requirements(
            document_type, extracted_data
        )
        errors.extend(min_req_errors)

        # Check 4: Impossible values
        impossible_errors = QualityValidator._check_impossible_values(
            document_type, extracted_data
        )
        errors.extend(impossible_errors)

        # Check 5: Hallucination detection
        hallucination_errors = QualityValidator._detect_hallucinations(
            extracted_data, ocr_text
        )
        errors.extend(hallucination_errors)

        # Check 6: Confidence threshold
        if confidence_score < 30:
            errors.append(f"Confidence score too low: {confidence_score:.1f}")

        # Determine if recovery should be attempted
        should_attempt_recovery = (
            len(errors) <= 3 and
            confidence_score >= 40 and
            "Invalid JSON structure" not in errors
        )

        is_valid = len(errors) == 0

        return is_valid, errors, should_attempt_recovery

    @staticmethod
    def _check_minimum_requirements(
        document_type: str,
        extracted_data: Dict[str, Any]
    ) -> List[str]:
        """Check if minimum required fields are present."""
        errors = []
        requirements = QualityValidator.MINIMUM_REQUIREMENTS.get(document_type, {})

        for field, min_count in requirements.items():
            value = extracted_data.get(field)

            if isinstance(value, list):
                if len(value) < min_count:
                    errors.append(
                        f"Insufficient {field}: expected at least {min_count}, got {len(value)}"
                    )
            elif isinstance(value, str):
                if not value.strip() and min_count > 0:
                    errors.append(f"Missing required field: {field}")
            elif value is None and min_count > 0:
                errors.append(f"Missing required field: {field}")

        return errors

    @staticmethod
    def _check_impossible_values(
        document_type: str,
        extracted_data: Dict[str, Any]
    ) -> List[str]:
        """Check for impossible or clearly wrong values."""
        errors = []

        # Check medicines for impossible names
        medicines = extracted_data.get("medicines", [])
        if medicines:
            for med in medicines:
                med_name = med.get("name", "").lower()
                if med_name in QualityValidator.IMPOSSIBLE_MEDICINES:
                    errors.append(f"Impossible medicine name: {med_name}")

        # Check for negative values where inappropriate
        if "total_amount" in extracted_data:
            amount = extracted_data.get("total_amount", "")
            if amount and "-" in str(amount):
                errors.append("Negative total amount")

        # Check for obviously invalid dates
        date_fields = ["test_date", "admission_date", "discharge_date", "issue_date", "bill_date"]
        for field in date_fields:
            if field in extracted_data:
                date_val = extracted_data.get(field, "")
                if date_val and not re.search(r'\d{4}', str(date_val)):
                    errors.append(f"Invalid date format in {field}")

        return errors

    @staticmethod
    def _detect_hallucinations(
        extracted_data: Dict[str, Any],
        ocr_text: str
    ) -> List[str]:
        """
        Detect potential hallucinations by checking if extracted values exist in OCR text.
        """
        errors = []
        ocr_lower = ocr_text.lower()

        # Check if extracted medicines appear in OCR
        medicines = extracted_data.get("medicines", [])
        if medicines:
            for med in medicines:
                med_name = med.get("name", "").lower()
                # Allow for some OCR variations (remove special chars)
                med_name_clean = re.sub(r'[^a-z0-9]', '', med_name)
                ocr_clean = re.sub(r'[^a-z0-9]', '', ocr_lower)

                if med_name_clean and med_name_clean not in ocr_clean:
                    # Check if it's a known medicine (might be inferred)
                    from services.medicine_extractor import MedicineExtractor
                    if not MedicineExtractor._is_valid_medicine(med_name):
                        errors.append(f"Potential hallucination: medicine '{med_name}' not found in OCR")

        # Check if doctor/hospital appears in OCR
        doctor_or_hospital = extracted_data.get("doctor_name", "") or extracted_data.get("hospital", "")
        if doctor_or_hospital:
            doc_hosp_clean = re.sub(r'[^a-z0-9]', '', doctor_or_hospital.lower())
            ocr_clean = re.sub(r'[^a-z0-9]', '', ocr_lower)
            if doc_hosp_clean and doc_hosp_clean not in ocr_clean:
                # This might be okay if it's inferred from context
                pass

        return errors

    @staticmethod
    def attempt_recovery(
        document_type: str,
        extracted_data: Dict[str, Any],
        ocr_text: str
    ) -> Dict[str, Any]:
        """
        Attempt to recover from validation errors.
        
        Recovery strategies:
        1. Remove impossible medicines
        2. Fill in missing fields with empty values
        3. Clean up obviously wrong values
        """
        recovered_data = extracted_data.copy()

        # Remove impossible medicines
        medicines = recovered_data.get("medicines", [])
        if medicines:
            valid_medicines = []
            for med in medicines:
                med_name = med.get("name", "").lower()
                if med_name not in QualityValidator.IMPOSSIBLE_MEDICINES:
                    valid_medicines.append(med)
            recovered_data["medicines"] = valid_medicines

        # Ensure required fields exist (even if empty)
        from services.extraction_schemas import EXTRACTION_SCHEMAS
        schema = EXTRACTION_SCHEMAS.get(document_type)
        if schema:
            for field in schema.get("required_fields", []):
                if field not in recovered_data:
                    recovered_data[field] = ""

        # Clean up negative amounts
        if "total_amount" in recovered_data:
            amount = str(recovered_data.get("total_amount", ""))
            if "-" in amount:
                recovered_data["total_amount"] = amount.replace("-", "")

        return recovered_data

    @staticmethod
    def should_reject_document(
        document_type: str,
        confidence_score: float,
        validation_errors: List[str]
    ) -> bool:
        """
        Determine if a document should be rejected entirely.
        
        Relaxed rejection criteria - only reject truly invalid documents:
        1. Document classified as non-medical
        2. Confidence score below very low threshold (10)
        3. Invalid JSON structure only
        """
        # Reject non-medical documents
        if document_type == "not_medical_document":
            return True

        # Reject only extremely low confidence (below 10%)
        if confidence_score < 10:
            return True

        # Reject only on critical JSON errors
        if any("Invalid JSON structure" in err for err in validation_errors):
            return True

        # Do NOT reject for missing fields or insufficient data
        # Gemini is the primary source of truth
        return False
