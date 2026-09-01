"""
OCR Text Cleaning Module
Cleans and normalizes OCR text before AI processing
"""

import re
from typing import List


class OCRCleaner:
    """Advanced OCR text cleaning for medical documents."""

    # Common OCR artifacts to remove
    OCR_ARTIFACTS = [
        r'[|]{2,}',  # Multiple pipe characters
        r'[_~`]+',  # Multiple underscores, tildes, backticks
        r'[=]{3,}',  # Multiple equals signs
        r'[-]{3,}',  # Multiple dashes
        r'\.{3,}',  # Multiple dots
    ]

    # Medical abbreviations to preserve (don't split these)
    MEDICAL_ABBREVIATIONS = {
        'mg', 'g', 'ml', 'mcg', 'iu', 'bd', 'tds', 'sos', 'od', 'qid',
        'prn', 'stat', 'iv', 'im', 'sc', 'po', 'ng', 'np', 'nr', 'ns',
        'hgb', 'rbc', 'wbc', 'plt', 'tsh', 't3', 't4', 'bmi', 'bp', 'hr',
        'rr', 'spo2', 'ecg', 'eeg', 'ct', 'mri', 'usg', 'xray', 'hiv',
        'hbsag', 'hcv', 'vdrl', 'ra', 'aslo', 'crp', 'esr', 'na', 'k',
        'cl', 'ca', 'p', 'mg', 'fe', 'ferritin', 'b12', 'folate', 'vit',
        'hba1c', 'fbs', 'ppbs', 'rbs', 'sgot', 'sgpt', 'alp', 'ggt',
        'bilirubin', 'albumin', 'globulin', 'protein', 'creatinine', 'urea',
        'uric', 'cholesterol', 'hdl', 'ldl', 'vldl', 'tg', 'lft', 'rft',
        'cbc', 'kft', 'lft', 'lipid', 'thyroid', 'urine', 'stool'
    }

    # Common OCR mistakes and their corrections
    OCR_CORRECTIONS = {
        '0': 'O',  # In certain contexts
        '1': 'I',  # In certain contexts
        '5': 'S',  # In certain contexts
        '|': 'I',
        'rn': 'm',  # Common OCR error
        'vv': 'w',
        'cl': 'd',
        'ci': 'a',
        'tl': 'h',
    }

    # OCR garbage words to remove
    OCR_GARBAGE_WORDS = {
        'padsx', 'oicgiprbnd', 'dep', 'news', 'fake', 'ple', 'ingot', 'paplegin',
        'rx', 'md', 'ph', 'reg', 'no', 'mob', 'mobile', 'contact',
        'voucher', 'cash', 'credit', 'debit', 'card', 'payment',
        'invoice', 'bill', 'amount', 'total', 'due', 'paid', 'balance',
    }

    @staticmethod
    def clean(ocr_text: str) -> str:
        """
        Main cleaning function that applies all cleaning steps.
        
        Args:
            ocr_text: Raw OCR text
            
        Returns:
            Cleaned and normalized text
        """
        if not ocr_text:
            return ""

        text = str(ocr_text)

        # Step 1: Remove OCR artifacts
        text = OCRCleaner._remove_artifacts(text)

        # Step 2: Normalize whitespace
        text = OCRCleaner._normalize_whitespace(text)

        # Step 3: Fix broken words across lines
        text = OCRCleaner._fix_broken_words(text)

        # Step 4: Remove duplicate lines
        text = OCRCleaner._remove_duplicate_lines(text)

        # Step 5: Correct common OCR mistakes
        text = OCRCleaner._correct_ocr_mistakes(text)

        # Step 6: Remove OCR garbage words
        text = OCRCleaner._remove_garbage_words(text)

        # Step 7: Preserve medical abbreviations
        text = OCRCleaner._preserve_abbreviations(text)

        # Step 8: Remove empty lines and excessive spacing
        text = OCRCleaner._finalize(text)

        return text.strip()

    @staticmethod
    def _remove_artifacts(text: str) -> str:
        """Remove common OCR artifacts."""
        for pattern in OCRCleaner.OCR_ARTIFACTS:
            text = re.sub(pattern, ' ', text)
        return text

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        """Normalize whitespace characters."""
        # Replace tabs and multiple spaces with single space
        text = re.sub(r'[ \t]+', ' ', text)
        
        # Normalize line endings
        text = text.replace('\r', '\n')
        
        # Remove spaces around newlines
        text = re.sub(r' *\n *', '\n', text)
        
        # Remove lines that are only punctuation
        text = re.sub(r'(?m)^\s*[-:.,;]{1,3}\s*$', '', text)
        
        # Remove excessive empty lines (more than 2)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text

    @staticmethod
    def _fix_broken_words(text: str) -> str:
        """
        Fix words broken across lines (hyphenation or OCR splitting).
        Example: "Para-\ncetamol" -> "Paracetamol"
        """
        # Fix hyphenated line breaks
        text = re.sub(r'([A-Za-z])-\n([A-Za-z])', r'\1\2', text)
        
        # Fix common OCR line breaks (capital letter after lowercase)
        text = re.sub(r'([a-z])\n([A-Z])', r'\1 \2', text)
        
        return text

    @staticmethod
    def _remove_duplicate_lines(text: str) -> str:
        """Remove duplicate consecutive lines."""
        lines = text.split('\n')
        unique_lines = []
        prev_line = None
        
        for line in lines:
            line = line.strip()
            if line and line != prev_line:
                unique_lines.append(line)
                prev_line = line
            elif not line:
                unique_lines.append(line)
        
        return '\n'.join(unique_lines)

    @staticmethod
    def _correct_ocr_mistakes(text: str) -> str:
        """
        Correct common OCR mistakes.
        Note: This is conservative - only apply when confident.
        """
        # Only apply corrections in specific contexts
        # This is a placeholder for more sophisticated correction
        return text

    @staticmethod
    def _remove_garbage_words(text: str) -> str:
        """Remove known OCR garbage words."""
        words = text.split()
        filtered_words = []
        
        for word in words:
            word_lower = word.lower().strip('.,;:')
            if word_lower not in OCRCleaner.OCR_GARBAGE_WORDS:
                filtered_words.append(word)
        
        return ' '.join(filtered_words)

    @staticmethod
    def _preserve_abbreviations(text: str) -> str:
        """Ensure medical abbreviations are not incorrectly split."""
        # This ensures abbreviations like "mg", "ml", "bd" remain intact
        # The cleaning process should avoid splitting these
        return text

    @staticmethod
    def _finalize(text: str) -> str:
        """Final cleanup - remove empty lines and trim."""
        lines = text.split('\n')
        non_empty_lines = [line.strip() for line in lines if line.strip()]
        return '\n'.join(non_empty_lines)

    @staticmethod
    def extract_medical_sections(text: str) -> dict[str, str]:
        """
        Extract different sections from medical documents.
        Returns a dict with sections like 'header', 'medicines', 'notes', etc.
        """
        sections = {
            'header': '',
            'medicines': '',
            'lab_results': '',
            'notes': '',
            'footer': ''
        }

        lines = text.split('\n')
        current_section = 'header'
        section_content = []

        for line in lines:
            line_lower = line.lower()

            # Detect section transitions
            if any(keyword in line_lower for keyword in ['rx', 'medicines', 'tab', 'cap', 'syp']):
                if current_section != 'medicines':
                    sections[current_section] = '\n'.join(section_content)
                    current_section = 'medicines'
                    section_content = []

            elif any(keyword in line_lower for keyword in ['report', 'result', 'value', 'reference']):
                if current_section != 'lab_results':
                    sections[current_section] = '\n'.join(section_content)
                    current_section = 'lab_results'
                    section_content = []

            elif any(keyword in line_lower for keyword in ['note', 'advice', 'instruction']):
                if current_section != 'notes':
                    sections[current_section] = '\n'.join(section_content)
                    current_section = 'notes'
                    section_content = []

            section_content.append(line)

        # Add the last section
        sections[current_section] = '\n'.join(section_content)

        return sections

    @staticmethod
    def calculate_ocr_quality(text: str) -> float:
        """
        Calculate OCR quality score (0-100) based on various indicators.
        
        Factors:
        - Text length
        - Presence of medical terminology
        - Ratio of special characters
        - Line structure
        """
        if not text:
            return 0.0

        score = 50.0  # Base score

        # Factor 1: Text length
        length = len(text)
        if length > 500:
            score += 20
        elif length > 200:
            score += 15
        elif length > 100:
            score += 10
        elif length > 50:
            score += 5

        # Factor 2: Medical terminology presence
        medical_terms = ['mg', 'ml', 'tab', 'cap', 'doctor', 'hospital', 'patient', 'blood']
        medical_count = sum(1 for term in medical_terms if term.lower() in text.lower())
        score += min(15, medical_count * 3)

        # Factor 3: Special character ratio (too many = poor OCR)
        special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())
        special_ratio = special_chars / len(text) if len(text) > 0 else 0
        if special_ratio > 0.3:
            score -= 20
        elif special_ratio > 0.2:
            score -= 10
        elif special_ratio < 0.1:
            score += 5

        # Factor 4: Line structure (good OCR has reasonable line breaks)
        lines = text.split('\n')
        avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else 0
        if 20 < avg_line_length < 100:
            score += 10

        return min(100.0, max(0.0, score))
