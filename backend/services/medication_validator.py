"""
Medication Validator Module
Validates medicine names against medical knowledge base
"""

from typing import List, Dict, Tuple
from .medical_dictionary import MedicalDictionary
import re

class MedicationValidator:
    """Validates medicines using medical knowledge base."""

    INVALID_PATTERNS = [
        r"\bdate\b",
        r"\baddress\b",
        r"\bpatient\b",
        r"\bdoctor\b",
        r"\bage\b",
        r"\bmale\b",
        r"\bfemale\b",
        r"\bmr\b",
        r"\bmrs\b",
        r"\bms\b",
        r"\bnov\b",
        r"\bjan\b",
        r"\bfeb\b",
        r"\bmar\b",
        r"\bapr\b",
        r"\bmay\b",
        r"\bjun\b",
        r"\bjul\b",
        r"\baug\b",
        r"\bsep\b",
        r"\boct\b",
        r"\bdec\b",
        r"\b19\d{2}\b",
        r"\b20\d{2}\b",
        r"\broad\b",
        r"\bstreet\b",
        r"\bhospital\b",
        r"\bclinic\b",
        r"\bphone\b",
        r"\bmobile\b",
        r"\bcontact\b",
        r"\bpin\b",
        r"\bemail\b",
        r"\bwww\b",
        r"\bhttp\b",
    ]

    @staticmethod
    def validate_medicines(medicines: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], float]:
        """
        Validate a list of medicines.
        
        Relaxed validation - Gemini is primary source of truth.
        Only filter obvious garbage, keep everything else.

        Args:
            medicines: List of medicine dictionaries with 'name', 'dosage', 'duration'

        Returns:
            (valid_medicines, suspicious_medicines, overall_confidence)
        """

        valid_medicines = []
        suspicious_medicines = []
        confidence_scores = []

        for med in medicines:

            name = med.get("name", "").strip()

            if not name:
                continue

            # Only reject obvious OCR garbage (dates, addresses, etc.)
            invalid = False
            for pattern in MedicationValidator.INVALID_PATTERNS:
                if re.search(pattern, name.lower()):
                    invalid = True
                    break

            if invalid:
                continue

            # Reject names that are mostly digits (clearly OCR errors)
            digits = sum(c.isdigit() for c in name)
            if digits > len(name) / 2:
                continue

            # Validate medicine but don't reject based on confidence
            is_valid, reason = MedicalDictionary.is_valid_medicine(name)
            confidence = MedicalDictionary.get_medicine_confidence(name)

            # Fuzzy correction for low confidence
            if confidence < 50:
                corrected_name = MedicalDictionary.fuzzy_correct(name)

                if corrected_name != name:
                    med["name"] = corrected_name
                    name = corrected_name

                    is_valid, reason = MedicalDictionary.is_valid_medicine(name)
                    confidence = MedicalDictionary.get_medicine_confidence(name)

            med_copy = med.copy()
            med_copy["confidence"] = confidence
            med_copy["validation_reason"] = reason

            # Keep all medicines except obvious garbage
            # Mark as suspicious only if it's clearly not a medicine
            if reason in ["body_part", "examination_term", "ocr_garbage", "common_english"]:
                suspicious_medicines.append(med_copy)
            else:
                valid_medicines.append(med_copy)
                confidence_scores.append(confidence)

        # Remove duplicates
        unique = {}

        for med in valid_medicines:
            key = med["name"].lower().strip()

            if key not in unique:
                unique[key] = med

        valid_medicines = list(unique.values())

        overall_confidence = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores
            else 0.0
        )

        return valid_medicines, suspicious_medicines, overall_confidence
    
    @staticmethod
    def filter_medicines(medicines: List[Dict[str, str]], min_confidence: float = 50.0) -> List[Dict[str, str]]:
        """
        Filter medicines by minimum confidence threshold.
        
        Args:
            medicines: List of medicine dictionaries
            min_confidence: Minimum confidence threshold (0-100)
            
        Returns:
            Filtered list of medicines
        """
        valid, _, _ = MedicationValidator.validate_medicines(medicines)
        return [med for med in valid if med.get("confidence", 0) >= min_confidence]
    
    @staticmethod
    def remove_false_positives(medicines: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Remove obvious false positives (body parts, organs, etc.).
        
        Args:
            medicines: List of medicine dictionaries
            
        Returns:
            Cleaned list of medicines
        """
        cleaned = []
        
        for med in medicines:
            name = med.get("name", "").strip()
            is_valid, reason = MedicalDictionary.is_valid_medicine(name)
            
            # Reject if it's a body part, examination term, or OCR garbage
            if reason in ["body_part", "examination_term", "ocr_garbage", "common_english"]:
                continue
            
            cleaned.append(med)
        
        return cleaned
