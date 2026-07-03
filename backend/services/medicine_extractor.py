"""
Advanced Medicine Extraction with Heuristics
Extracts medicines only from appropriate document types with strict validation
"""

import re
from typing import List, Dict, Set
from .medical_dictionary import MedicalDictionary


class MedicineExtractor:
    """Advanced medicine extraction with strict heuristics to avoid false positives."""

    # Common medicine name patterns (realistic medicine naming conventions)
    MEDICINE_PATTERNS = [
        # Brand names with common suffixes
        r'\b[A-Z][a-z]+(?:[+-][A-Z][a-z]+)*(?:\s+(?:SR|XR|CR|ER|LA|Retard))?\b',
        # Generic names with common endings
        r'\b[A-Z][a-z]+(?:mox|cillin|mycin|pril|sartan|statin|azole|tidine|olol|prazole|vir)\b',
        # Compound medicines
        r'\b[A-Z][a-z]+[+-][A-Z][a-z]+\b',
    ]

    # Medicine prefixes (form types)
    MEDICINE_PREFIXES = {
        'tab', 'tablet', 'cap', 'capsule', 'syp', 'syrup', 'inj', 'injection',
        'drop', 'cream', 'ointment', 'gel', 'lotion', 'spray', 'powder',
        'granules', 'solution', 'suspension', 'emulsion'
    }

    # Dosage units
    DOSAGE_UNITS = {
        'mg', 'g', 'ml', 'mcg', 'iu', 'ug', 'ng', '%', 'units'
    }

    # Common dosage frequency patterns
    DOSAGE_FREQUENCY = {
        'od', 'bd', 'tds', 'qid', 'qhs', 'prn', 'sos', 'stat',
        '1-0-1', '1-0-0', '0-0-1', '0-1-0', '1-1-1', 'once daily',
        'twice daily', 'thrice daily', 'four times daily', 'q8h', 'q6h', 'q4h'
    }

    # Body parts and examination terms (NEVER extract as medicines)
    BODY_PARTS = {
        'heart', 'lungs', 'abdomen', 'stomach', 'liver', 'kidney', 'brain',
        'chest', 'thorax', 'spine', 'neck', 'head', 'eyes', 'ears', 'nose',
        'throat', 'skin', 'bone', 'joint', 'muscle', 'nerve', 'blood',
        'artery', 'vein', 'uterus', 'ovary', 'prostate', 'bladder', 'intestine'
    }

    # Examination findings (NEVER extract as medicines)
    EXAMINATION_TERMS = {
        'physical', 'examination', 'temperature', 'pulse', 'blood pressure',
        'respiratory', 'rate', 'weight', 'height', 'bmi', 'oxygen', 'saturation',
        'consciousness', 'orientation', 'reflex', 'pupil', 'sound', 'murmur',
        'rhythm', 'rate', 'regular', 'irregular', 'normal', 'abnormal',
        'clear', 'present', 'absent', 'positive', 'negative'
    }

    # Non-medical terms commonly found in prescriptions
    NON_MEDICINE_TERMS = {
        'life', 'line', 'clinic', 'hospital', 'doctor', 'patient', 'name', 'age',
        'sex', 'date', 'time', 'signature', 'advice', 'note', 'follow', 'up',
        'visit', 'report', 'lab', 'test', 'centre', 'center', 'road', 'street',
        'phone', 'reg', 'rx', 'md', 'ph', 'pharmacy', 'medical', 'store',
        'no', 'contact', 'mob', 'mobile', 'address', 'city', 'state', 'pin',
        'code', 'voucher', 'cash', 'credit', 'debit', 'card', 'payment',
        'invoice', 'bill', 'amount', 'total', 'due', 'paid', 'balance'
    }

    # Common medicine brand names (for validation)
    KNOWN_MEDICINES = {
        'azithromycin', 'amoxicillin', 'amoxiclav', 'augmentin', 'cefuroxime',
        'ceftriaxone', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin',
        'doxycycline', 'metronidazole', 'clarithromycin', 'erythromycin',
        'paracetamol', 'acetaminophen', 'ibuprofen', 'diclofenac', 'naproxen',
        'ketorolac', 'tramadol', 'morphine', 'codeine', 'omeprazole',
        'pantoprazole', 'rabeprazole', 'esomeprazole', 'ranitidine',
        'famotidine', 'metformin', 'glimepiride', 'sitagliptin', 'vildagliptin',
        'insulin', 'glipizide', 'glyburide', 'atorvastatin', 'simvastatin',
        'rosuvastatin', 'fenofibrate', 'amlodipine', 'nifedipine', 'enalapril',
        'lisinopril', 'ramipril', 'losartan', 'telmisartan', 'valsartan',
        'hydrochlorothiazide', 'furosemide', 'spironolactone', 'digoxin',
        'aspirin', 'clopidogrel', 'warfarin', 'dabigatran', 'rivaroxaban',
        'montelukast', 'salbutamol', 'formoterol', 'budesonide', 'fluticasone',
        'prednisone', 'dexamethasone', 'methylprednisolone', 'hydrocortisone',
        'levothyroxine', 'thyroxine', 'carbamazepine', 'phenytoin', 'valproate',
        'gabapentin', 'pregabalin', 'duloxetine', 'venlafaxine', 'sertraline',
        'fluoxetine', 'escitalopram', 'citalopram', 'paroxetine', 'alprazolam',
        'clonazepam', 'diazepam', 'lorazepam', 'zolpidem', 'eszopiclone',
        'donepezil', 'rivastigmine', 'memantine', 'piracetam', 'citicolin',
        'multivitamin', 'vitamin', 'calcium', 'iron', 'folic', 'acid',
        'omega', 'fish', 'oil', 'protein', 'probiotic', 'lactobacillus'
    }

    @staticmethod
    def extract_medicines(ocr_text: str, document_type: str) -> List[Dict[str, str]]:
        """
        Extract medicines from OCR text based on document type.
        
        Args:
            ocr_text: Cleaned OCR text
            document_type: Type of medical document
            
        Returns:
            List of medicine dictionaries with name, dosage, duration
        """
        # Only extract medicines from prescription and discharge summary
        if document_type not in ["prescription", "discharge_summary"]:
            print(f"[MEDICINE EXTRACTOR] Skipping medicine extraction for document type: {document_type}")
            return []

        medicines = []
        seen: Set[tuple[str, str]] = set()

        # Pattern 1: Prefix + Medicine Name + Dosage
        # Example: Tab Azithromycin 500mg, Cap Paracetamol
        prefix_pattern = r'(?:' + '|'.join(MedicineExtractor.MEDICINE_PREFIXES) + r')\s+([A-Z][a-zA-Z0-9+\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:' + '|'.join(MedicineExtractor.DOSAGE_UNITS) + r'))?)?'

        # Pattern 2: Medicine name with dosage (no prefix)
        # Example: Azithromycin 500mg, Paracetamol 650mg
        medicine_pattern = r'\b([A-Z][a-zA-Z0-9+\-\s]{3,30})\s+(\d+(?:\.\d+)?\s*(?:' + '|'.join(MedicineExtractor.DOSAGE_UNITS) + r'))'

        # Pattern 3: Known medicine names
        known_pattern = r'\b(' + '|'.join(MedicineExtractor.KNOWN_MEDICINES) + r')\b'

        patterns = [
            (prefix_pattern, 1, 2),  # (pattern, name_group, dosage_group)
            (medicine_pattern, 1, 2),
            (known_pattern, 1, None),
        ]

        for pattern, name_group, dosage_group in patterns:
            for match in re.finditer(pattern, ocr_text, re.IGNORECASE | re.MULTILINE):
                name = match.group(name_group).strip() if match.group(name_group) else ""
                dosage = match.group(dosage_group).strip() if dosage_group and match.lastindex >= dosage_group else ""

                # Clean up name
                name = re.sub(r'\s+', ' ', name)
                name = name.strip()

                # Validate medicine name
                if not MedicineExtractor._is_valid_medicine(name):
                    continue

                # Avoid duplicates
                key = (name.lower(), dosage.lower())
                if key in seen:
                    continue
                seen.add(key)

                medicines.append({
                    "name": name,
                    "dosage": dosage,
                    "duration": ""
                })

        print(f"[MEDICINE EXTRACTOR] Extracted {len(medicines)} medicines for document type: {document_type}")
        return medicines

    @staticmethod
    def _is_valid_medicine(name: str) -> bool:
        """
        Validate if a word is likely a medicine name using heuristics and medical dictionary.
        
        Args:
            name: Potential medicine name
            
        Returns:
            True if likely a medicine, False otherwise
        """
        # Use medical dictionary for validation
        is_valid, reason = MedicalDictionary.is_valid_medicine(name)
        
        # Reject if it's clearly not a medicine
        if reason in ["body_part", "examination_term", "ocr_garbage", "common_english", "too_short", "mostly_symbols"]:
            return False
        
        # Accept if validated by dictionary
        if is_valid:
            return True
        
        # Fallback to legacy heuristics for unknown medicines
        name_lower = name.lower()

        # Check if it's a known medicine from legacy list
        if name_lower in MedicineExtractor.KNOWN_MEDICINES:
            return True

        # Pattern: Capitalized word with medical-sounding structure
        # Must have at least one uppercase letter and look like a brand name
        if re.match(r'^[A-Z][a-z]+(?:[+-][A-Z][a-z]+)*$', name):
            # Additional check: should not be a common English word
            common_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'}
            if name_lower not in common_words:
                return True

        return False

    @staticmethod
    def extract_dosage_frequency(text: str) -> str:
        """Extract dosage frequency from text."""
        text_lower = text.lower()
        
        for freq in MedicineExtractor.DOSAGE_FREQUENCY:
            if freq in text_lower:
                return freq
        
        return ""

    @staticmethod
    def extract_duration(text: str) -> str:
        """Extract duration from text."""
        # Pattern: X days, X weeks, X months
        duration_pattern = r'(\d+)\s*(day|week|month)s?'
        match = re.search(duration_pattern, text, re.IGNORECASE)
        
        if match:
            return f"{match.group(1)} {match.group(2)}{'s' if int(match.group(1)) > 1 else ''}"
        
        return ""
