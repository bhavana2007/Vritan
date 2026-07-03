"""
Confidence Score Calculation
Calculates comprehensive confidence scores based on multiple factors
"""

import json
import re
from typing import Dict, Any


class ConfidenceCalculator:
    """Calculate confidence scores for AI extraction results."""

    @staticmethod
    def calculate_comprehensive_confidence(
        ocr_text: str,
        cleaned_text: str,
        document_type: str,
        classification_confidence: float,
        extracted_data: Dict[str, Any],
        ocr_quality: float,
        schema_valid: bool,
        processing_time: float
    ) -> Dict[str, float]:
        """
        Calculate comprehensive confidence scores (0-100) based on multiple factors.
        
        Returns separate scores for:
        - OCR confidence
        - Classification confidence
        - Medicine confidence
        - Disease confidence
        - Doctor confidence
        - Hospital confidence
        - Overall AI confidence
        
        Args:
            ocr_text: Raw OCR text
            cleaned_text: Cleaned OCR text
            document_type: Classified document type
            classification_confidence: Confidence from classification step
            extracted_data: Data extracted by AI
            ocr_quality: OCR quality score from cleaner
            schema_valid: Whether schema validation passed
            processing_time: Time taken for processing
            
        Returns:
            Dictionary with separate confidence scores
        """
        scores = {
            "ocr_confidence": 0.0,
            "classification_confidence": classification_confidence,
            "medicine_confidence": 0.0,
            "disease_confidence": 0.0,
            "doctor_confidence": 0.0,
            "hospital_confidence": 0.0,
            "overall_confidence": 0.0
        }
        
        # OCR confidence
        scores["ocr_confidence"] = ConfidenceCalculator._calculate_ocr_score(ocr_text, cleaned_text, ocr_quality)
        
        # Medicine confidence
        scores["medicine_confidence"] = ConfidenceCalculator._calculate_medicine_confidence(
            extracted_data, document_type
        )
        
        # Disease confidence
        scores["disease_confidence"] = ConfidenceCalculator._calculate_disease_confidence(
            extracted_data, document_type
        )
        
        # Doctor confidence
        scores["doctor_confidence"] = ConfidenceCalculator._calculate_doctor_confidence(
            extracted_data
        )
        
        # Hospital confidence
        scores["hospital_confidence"] = ConfidenceCalculator._calculate_hospital_confidence(
            extracted_data
        )
        
        # Overall confidence (weighted average)
        scores["overall_confidence"] = ConfidenceCalculator._calculate_overall_confidence(
            scores, schema_valid, processing_time, document_type, extracted_data, ocr_text
        )
        
        return scores
    
    @staticmethod
    def _calculate_overall_confidence(
        scores: Dict[str, float],
        schema_valid: bool,
        processing_time: float,
        document_type: str,
        extracted_data: Dict[str, Any],
        ocr_text: str
    ) -> float:
        """Calculate overall confidence from component scores."""
        score = 0.0
        
        # OCR quality (0-20 points)
        score += scores["ocr_confidence"] * 0.20
        
        # Classification confidence (0-15 points)
        score += scores["classification_confidence"] / 100 * 15
        
        # Schema validation (0-15 points)
        schema_score = 15 if schema_valid else 0
        score += schema_score
        
        # Field completeness (0-20 points)
        completeness_score = ConfidenceCalculator._calculate_completeness(document_type, extracted_data)
        score += completeness_score * 0.20
        
        # Data consistency (0-15 points)
        consistency_score = ConfidenceCalculator._calculate_consistency(extracted_data, document_type)
        score += consistency_score * 0.15
        
        # Processing time (0-5 points)
        if processing_time < 30:
            time_score = 5
        elif processing_time < 60:
            time_score = 4
        elif processing_time < 120:
            time_score = 3
        else:
            time_score = 2
        score += time_score
        
        # Document type match (0-10 points)
        type_match_score = ConfidenceCalculator._validate_document_type_match(
            document_type, extracted_data, ocr_text
        )
        score += type_match_score * 0.10
        
        return min(100.0, max(0.0, score))
    
    @staticmethod
    def _calculate_medicine_confidence(extracted_data: Dict[str, Any], document_type: str) -> float:
        """Calculate medicine extraction confidence."""
        # Only relevant for prescriptions and discharge summaries
        if document_type not in ["prescription", "discharge_summary"]:
            return 100.0  # N/A, so full confidence
        
        medicines = extracted_data.get("medicines", [])
        if not medicines:
            return 0.0
        
        # Calculate average confidence from individual medicines
        total_confidence = 0.0
        for med in medicines:
            conf = med.get("confidence", 50.0)
            total_confidence += conf
        
        return total_confidence / len(medicines) if medicines else 0.0
    
    @staticmethod
    def _calculate_disease_confidence(extracted_data: Dict[str, Any], document_type: str) -> float:
        """Calculate disease/condition extraction confidence."""
        diagnosis = extracted_data.get("diagnosis", "")
        
        if not diagnosis:
            return 0.0
        
        # High confidence if diagnosis is present and looks valid
        if len(diagnosis) > 5 and len(diagnosis) < 100:
            return 80.0
        
        return 50.0
    
    @staticmethod
    def _calculate_doctor_confidence(extracted_data: Dict[str, Any]) -> float:
        """Calculate doctor extraction confidence."""
        doctor_name = (extracted_data.get("doctor_name") or "").strip()
        
        if not doctor_name:
            return 0.0
        
        # Check if it looks like a valid doctor name
        if doctor_name.startswith("Dr.") or "Dr " in doctor_name:
            return 90.0
        
        if len(doctor_name) > 3 and len(doctor_name) < 50:
            return 70.0
        
        return 50.0
    
    @staticmethod
    def _calculate_hospital_confidence(extracted_data: Dict[str, Any]) -> float:
        """Calculate hospital extraction confidence."""
        hospital = (extracted_data.get("hospital") or "").strip()
        
        if not hospital or hospital == "Unknown":
            return 0.0
        
        # Check if it looks like a valid hospital name
        if len(hospital) > 3 and len(hospital) < 100:
            return 80.0
        
        return 50.0

    @staticmethod
    def _calculate_ocr_score(ocr_text: str, cleaned_text: str, ocr_quality: float) -> float:
        """Calculate OCR quality contribution."""
        # Use the OCR quality from cleaner
        base_score = ocr_quality

        # Bonus if cleaning improved text significantly
        if len(cleaned_text) > len(ocr_text) * 0.8:
            base_score += 5

        # Penalty if text is too short
        if len(cleaned_text) < 50:
            base_score -= 20

        return min(100.0, max(0.0, base_score))

    @staticmethod
    def _calculate_completeness(document_type: str, extracted_data: Dict[str, Any]) -> float:
        """
        Calculate field completeness score (0-100).
        
        Checks how many expected fields are filled.
        """
        from services.extraction_schemas import EXTRACTION_SCHEMAS

        schema = EXTRACTION_SCHEMAS.get(document_type)
        if not schema:
            return 50.0  # Unknown document type

        required_fields = schema.get("required_fields", [])
        optional_fields = schema.get("optional_fields", [])

        filled_required = sum(1 for field in required_fields if extracted_data.get(field))
        filled_optional = sum(1 for field in optional_fields if extracted_data.get(field))

        # Required fields are more important
        required_score = (filled_required / len(required_fields)) * 70 if required_fields else 70
        optional_score = (filled_optional / len(optional_fields)) * 30 if optional_fields else 30

        return required_score + optional_score

    @staticmethod
    def _calculate_consistency(extracted_data: Dict[str, Any], document_type: str) -> float:
        """
        Calculate data consistency score (0-100).
        
        Checks for internal consistency in extracted data.
        """
        score = 100.0

        # Check for empty critical fields
        if document_type == "prescription":
            if not extracted_data.get("medicines"):
                score -= 50
            if not extracted_data.get("doctor_name") and not extracted_data.get("hospital"):
                score -= 20

        elif document_type == "blood_report":
            if not extracted_data.get("parameters"):
                score -= 50

        elif document_type == "hospital_bill":
            if not extracted_data.get("total_amount"):
                score -= 50

        # Check for obviously invalid values
        if "total_amount" in extracted_data:
            amount = extracted_data.get("total_amount", "")
            if amount and not re.search(r'\d', str(amount)):
                score -= 30

        # Check for medicines in non-prescription documents
        if document_type not in ["prescription", "discharge_summary"]:
            if extracted_data.get("medicines"):
                score -= 40  # Penalty for medicines in wrong document type

        return max(0.0, score)

    @staticmethod
    def _validate_document_type_match(
        document_type: str,
        extracted_data: Dict[str, Any],
        ocr_text: str
    ) -> float:
        """
        Validate that extracted data matches the document type (0-100).
        """
        ocr_lower = ocr_text.lower()

        # Check if OCR text contains keywords consistent with document type
        type_keywords = {
            "prescription": ["rx", "tab", "cap", "syp", "dosage", "medicine"],
            "blood_report": ["hemoglobin", "rbc", "wbc", "platelet", "blood", "sugar"],
            "lab_report": ["laboratory", "specimen", "culture", "sensitivity"],
            "radiology_report": ["radiology", "findings", "impression"],
            "mri": ["mri", "magnetic resonance", "t1", "t2", "flair"],
            "ct_scan": ["ct", "computed tomography", "contrast"],
            "xray": ["x-ray", "radiograph", "chest"],
            "vaccination_record": ["vaccine", "vaccination", "immunization"],
            "discharge_summary": ["discharge", "admission", "hospital course"],
            "medical_certificate": ["certificate", "fitness", "certify"],
            "hospital_bill": ["invoice", "bill", "amount", "charges"],
            "insurance_document": ["insurance", "claim", "policy"],
            "referral_letter": ["referral", "referred", "consult"],
            "ecg_report": ["ecg", "electrocardiogram", "sinus rhythm"],
            "ultrasound_report": ["ultrasound", "sonography", "usg"]
        }

        keywords = type_keywords.get(document_type, [])
        if not keywords:
            return 80.0  # Unknown type, give moderate score

        keyword_count = sum(1 for kw in keywords if kw in ocr_lower)
        keyword_score = (keyword_count / len(keywords)) * 100

        return max(0.0, min(100.0, keyword_score))

    @staticmethod
    def calculate_gemini_confidence(gemini_response: Dict[str, Any]) -> float:
        """
        Extract confidence from Gemini's own response if available.
        """
        return gemini_response.get("confidence", 50.0)
