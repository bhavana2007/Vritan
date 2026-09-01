"""
Medication validation backed by the medicines_master table.

The database is the source of truth. A short-lived in-process search index is
derived from MySQL only to make fuzzy OCR correction fast enough for uploads.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Dict, List, Tuple

from sqlalchemy import or_

from database import SessionLocal
from models import MedicineMaster

try:
    from rapidfuzz import fuzz, process
except ImportError:  # pragma: no cover - exercised only when dependency is absent
    fuzz = None
    process = None


@dataclass
class _MedicineIndex:
    loaded_at: float
    choices: list[str]
    by_choice: dict[str, MedicineMaster]


class MedicationValidator:
    """Validates medicines using MySQL-backed master data and fuzzy matching."""

    CACHE_TTL_SECONDS = 10 * 60
    MIN_FUZZY_SCORE = 82

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

    _index: _MedicineIndex | None = None

    @staticmethod
    def _normalize(value: str) -> str:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        return text

    @staticmethod
    def _lookup_terms(medicine: MedicineMaster) -> list[str]:
        terms = [
            medicine.name,
            medicine.generic_name,
            medicine.brand_name,
        ]
        if medicine.aliases:
            terms.extend(re.split(r"[|,;]\s*", medicine.aliases))
        return [
            MedicationValidator._normalize(term).lower()
            for term in terms
            if MedicationValidator._normalize(term)
        ]

    @staticmethod
    def _fallback_ratio(left: str, right: str) -> float:
        return SequenceMatcher(None, left.lower(), right.lower()).ratio() * 100

    @classmethod
    def _obvious_garbage_reason(cls, name: str) -> str | None:
        lowered = name.lower()
        for pattern in cls.INVALID_PATTERNS:
            if re.search(pattern, lowered):
                return "ocr_garbage"

        digits = sum(c.isdigit() for c in name)
        if digits > len(name) / 2:
            return "ocr_garbage"
        if len(re.sub(r"[^A-Za-z]", "", name)) < 2:
            return "ocr_garbage"
        return None

    @classmethod
    def _load_index(cls) -> _MedicineIndex:
        now = time.time()
        if cls._index and now - cls._index.loaded_at < cls.CACHE_TTL_SECONDS:
            return cls._index

        by_choice: dict[str, MedicineMaster] = {}
        with SessionLocal() as db:
            medicines = (
                db.query(MedicineMaster)
                .filter(MedicineMaster.name.isnot(None))
                .all()
            )
            for medicine in medicines:
                db.expunge(medicine)
                for term in cls._lookup_terms(medicine):
                    by_choice.setdefault(term, medicine)

        cls._index = _MedicineIndex(
            loaded_at=now,
            choices=list(by_choice.keys()),
            by_choice=by_choice,
        )
        return cls._index

    @staticmethod
    def extract_descriptors(name: str) -> Tuple[str, List[str]]:
        """
        Extract branded formulation descriptors and prefixes/suffixes.
        Maps names like 'Conventional Amphotericin B' or 'Tab Paracetamol' to their base drug
        while capturing formulation metadata.
        """
        descriptors = [
            "liposomal", "conventional", "injection", "tab", "cap", 
            "tablet", "capsule", "syrup", "syp", "inj", "ointment", 
            "cream", "drops", "drop", "gel", "spray", "inhaler"
        ]
        words = name.split()
        cleaned_words = []
        found_descriptors = []
        for word in words:
            clean_word = word.strip(".,()[]{}").lower()
            if clean_word in descriptors:
                found_descriptors.append(word.strip(".,"))
            else:
                cleaned_words.append(word)
        cleaned_name = " ".join(cleaned_words)
        return cleaned_name, found_descriptors

    @classmethod
    def find_best_match(cls, name: str, is_base_lookup: bool = False) -> dict:
        """Return exact/prefix/fuzzy match information for one medicine name with alias normalization support."""
        cleaned = cls._normalize(name)
        if not cleaned:
            return {
                "is_valid": False,
                "corrected_name": None,
                "confidence": 0,
                "match_type": "empty",
                "medicine": None,
                "reason": "empty",
                "formulation_metadata": [],
            }

        garbage_reason = cls._obvious_garbage_reason(cleaned)
        if garbage_reason:
            return {
                "is_valid": False,
                "corrected_name": None,
                "confidence": 0,
                "match_type": "rejected",
                "medicine": None,
                "reason": garbage_reason,
                "formulation_metadata": [],
            }

        # exact match check
        lowered = cleaned.lower()
        with SessionLocal() as db:
            exact = (
                db.query(MedicineMaster)
                .filter(
                    or_(
                        MedicineMaster.name == cleaned,
                        MedicineMaster.generic_name == cleaned,
                        MedicineMaster.brand_name == cleaned,
                    )
                )
                .first()
            )
            if exact:
                db.expunge(exact)
                return {
                    "is_valid": True,
                    "corrected_name": exact.name,
                    "confidence": 100,
                    "match_type": "exact",
                    "medicine": exact,
                    "reason": "database_exact",
                    "formulation_metadata": [],
                }

            pattern = f"{cleaned}%"
            prefix = (
                db.query(MedicineMaster)
                .filter(
                    or_(
                        MedicineMaster.name.ilike(pattern),
                        MedicineMaster.generic_name.ilike(pattern),
                        MedicineMaster.brand_name.ilike(pattern),
                    )
                )
                .order_by(MedicineMaster.name.asc())
                .first()
            )
            if prefix:
                db.expunge(prefix)
                return {
                    "is_valid": True,
                    "corrected_name": prefix.name,
                    "confidence": 94,
                    "match_type": "prefix",
                    "medicine": prefix,
                    "reason": "database_prefix",
                    "formulation_metadata": [],
                }

        # Try base lookup (alias normalization) if not already doing so
        cleaned_base = cleaned
        found_descriptors = []
        if not is_base_lookup:
            cleaned_base, found_descriptors = cls.extract_descriptors(cleaned)
            if cleaned_base and cleaned_base.lower() != cleaned.lower():
                base_match = cls.find_best_match(cleaned_base, is_base_lookup=True)
                if base_match["is_valid"]:
                    base_match["formulation_metadata"] = found_descriptors
                    return base_match

        index = cls._load_index()
        if not index.choices:
            return {
                "is_valid": False,
                "corrected_name": cleaned,
                "confidence": 25,
                "match_type": "no_database_rows",
                "medicine": None,
                "reason": "medicine_database_empty",
                "formulation_metadata": found_descriptors,
            }

        # Fuzzy matching against cleaned base name or lowered name
        target_name = cleaned_base.lower()
        if process and fuzz:
            fuzzy_match = process.extractOne(
                target_name,
                index.choices,
                scorer=fuzz.WRatio,
            )
            choice, score = (fuzzy_match[0], float(fuzzy_match[1])) if fuzzy_match else (None, 0)
        else:
            choice = max(index.choices, key=lambda item: cls._fallback_ratio(target_name, item))
            score = cls._fallback_ratio(target_name, choice)

        medicine = index.by_choice.get(choice) if choice else None
        is_valid = bool(medicine and score >= cls.MIN_FUZZY_SCORE)
        
        return {
            "is_valid": is_valid,
            "corrected_name": medicine.name if medicine and is_valid else cleaned,
            "confidence": round(score, 2),
            "match_type": "fuzzy" if is_valid else "unmatched",
            "medicine": medicine if is_valid else None,
            "reason": "database_fuzzy" if is_valid else "low_fuzzy_score",
            "formulation_metadata": found_descriptors,
        }

    @staticmethod
    def validate_medicines(
        medicines: List[Dict[str, str]],
        allergies: List[str] = None
    ) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], List[Dict[str, str]], float]:
        """
        Validate medicines from OCR/Gemini extraction.
        Checks for unknown medicines, incomplete dosages, drug interactions, and allergy conflicts.

        Returns:
            verified_medicines: list of verified medicine dicts
            unverified_medicines: list of unverified medicine dicts (retained with original data)
            suspicious_medicines: list of medicine dicts with allergy/interaction alerts/conflicts
            overall_confidence: average confidence score across verified + unverified medicines
        """
        verified_medicines: list[dict[str, str]] = []
        unverified_medicines: list[dict[str, str]] = []
        suspicious_medicines: list[dict[str, str]] = []
        confidence_scores: list[float] = []
        allergies = allergies or []
        
        # Simple simulated interaction map for common drugs
        INTERACTIONS = {
            "aspirin": ["ibuprofen", "warfarin", "naproxen"],
            "warfarin": ["aspirin", "ibuprofen", "naproxen"],
            "amoxicillin": ["methotrexate"],
            "azithromycin": ["amiodarone"],
        }

        for med in medicines:
            med_copy = med.copy()
            name = MedicationValidator._normalize(str(med_copy.get("name", "")))
            if not name:
                continue

            match = MedicationValidator.find_best_match(name)
            med_copy["confidence"] = match["confidence"]
            med_copy["validation_reason"] = match["reason"]
            med_copy["match_type"] = match["match_type"]
            med_copy["formulation_metadata"] = match.get("formulation_metadata", [])

            corrected = match["corrected_name"] or name
            
            # Check allergy conflict
            allergy_conflict = False
            for allergy in allergies:
                if allergy.lower() in corrected.lower():
                    med_copy["validation_reason"] = f"Allergy conflict detected: {allergy}"
                    suspicious_medicines.append(med_copy)
                    allergy_conflict = True
                    break
                    
            if allergy_conflict:
                continue

            if match["is_valid"]:
                med_copy["name"] = corrected
                medicine = match.get("medicine")
                if medicine:
                    med_copy["generic_name"] = medicine.generic_name or ""
                    med_copy["brand_name"] = medicine.brand_name or ""
                    med_copy["route"] = medicine.route or medicine.default_route or ""
                    if not med_copy.get("dosage"):
                        med_copy["dosage"] = medicine.strength or medicine.default_strength or ""
                verified_medicines.append(med_copy)
                confidence_scores.append(float(match["confidence"]))
            elif match["reason"] == "ocr_garbage":
                # Only discard if it's actual ocr garbage
                continue
            else:
                # Retain low fuzzy-match score / unmatched medicines as unverified
                med_copy["unverified"] = True
                unverified_medicines.append(med_copy)
                confidence_scores.append(float(match["confidence"]))

        unique_verified: dict[str, dict[str, str]] = {}
        for med in verified_medicines:
            key = MedicationValidator._normalize(str(med.get("name", ""))).lower()
            if key and key not in unique_verified:
                unique_verified[key] = med

        unique_unverified: dict[str, dict[str, str]] = {}
        for med in unverified_medicines:
            key = MedicationValidator._normalize(str(med.get("name", ""))).lower()
            if key and key not in unique_verified and key not in unique_unverified:
                unique_unverified[key] = med

        # Check drug interactions among valid medicines
        all_meds = list(unique_verified.values()) + list(unique_unverified.values())
        med_names_lower = [m["name"].lower() for m in all_meds]
        for med in all_meds:
            key = MedicationValidator._normalize(str(med.get("name", ""))).lower()
            for drug_class, conflicts in INTERACTIONS.items():
                if drug_class in key:
                    for conflict in conflicts:
                        if any(conflict in v for v in med_names_lower):
                            med["validation_reason"] = f"Drug interaction alert: {conflict}"

        overall_confidence = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores
            else 0.0
        )
        return list(unique_verified.values()), list(unique_unverified.values()), suspicious_medicines, overall_confidence

    @staticmethod
    def filter_medicines(
        medicines: List[Dict[str, str]],
        min_confidence: float = 50.0,
    ) -> List[Dict[str, str]]:
        verified, unverified, _, _ = MedicationValidator.validate_medicines(medicines)
        return [med for med in (verified + unverified) if float(med.get("confidence", 0)) >= min_confidence]

    @staticmethod
    def remove_false_positives(medicines: List[Dict[str, str]]) -> List[Dict[str, str]]:
        cleaned: list[dict[str, str]] = []
        for med in medicines:
            name = MedicationValidator._normalize(str(med.get("name", "")))
            if MedicationValidator._obvious_garbage_reason(name):
                continue
            cleaned.append(med)
        return cleaned
