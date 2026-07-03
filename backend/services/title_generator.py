"""
Title Generator Module
Generates document titles with abbreviation expansion
"""

from typing import Dict
from .condition_normalizer import ConditionNormalizer


class TitleGenerator:
    """Generates document titles with proper abbreviation expansion."""
    
    # Abbreviation mappings for title generation
    TITLE_ABBREVIATIONS: Dict[str, str] = {
        'GE': 'Gastroenteritis',
        'HTN': 'Hypertension',
        'DM': 'Diabetes Mellitus',
        'CAD': 'Coronary Artery Disease',
        'MI': 'Myocardial Infarction',
        'CVA': 'Stroke',
        'COPD': 'Chronic Obstructive Pulmonary Disease',
        'URI': 'Upper Respiratory Infection',
        'LRI': 'Lower Respiratory Infection',
        'UTI': 'Urinary Tract Infection',
        'CKD': 'Chronic Kidney Disease',
        'AKI': 'Acute Kidney Injury',
        'HBV': 'Hepatitis B',
        'HCV': 'Hepatitis C',
        'HIV': 'Human Immunodeficiency Virus',
        'TB': 'Tuberculosis',
        'AFib': 'Atrial Fibrillation',
        'CHF': 'Congestive Heart Failure',
        'DVT': 'Deep Vein Thrombosis',
        'PE': 'Pulmonary Embolism',
        'TIA': 'Transient Ischemic Attack',
        'GERD': 'Gastroesophageal Reflux Disease',
        'IBD': 'Inflammatory Bowel Disease',
        'IBS': 'Irritable Bowel Syndrome',
    }
    
    @staticmethod
    def generate_title(document_type: str, diagnosis: str = "", findings: str = "") -> str:
        """
        Generate a document title with expanded abbreviations.
        
        Args:
            document_type: Type of document
            diagnosis: Diagnosis or condition
            findings: Findings or observations
            
        Returns:
            Generated title
        """
        # Get document type display name
        from services.document_classifier import DOCUMENT_TYPES
        doc_info = DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["general_medical_report"])
        doc_display = doc_info.get("display_name", "Medical Document")
        
        # If no diagnosis or findings, return document type
        if not diagnosis and not findings:
            return doc_display
        
        # Use diagnosis as the primary title component
        title_text = diagnosis if diagnosis else findings
        
        # Expand abbreviations in the title
        expanded_title = TitleGenerator._expand_abbreviations(title_text)
        
        # Clean up the title
        expanded_title = expanded_title.strip()
        expanded_title = expanded_title.title()
        
        # Determine if we should call it a prescription
        # Only call it "Prescription" if it's actually a prescription document type
        if document_type == "prescription":
            return f"{expanded_title} Prescription"
        elif document_type == "discharge_summary":
            return f"{expanded_title} Discharge Summary"
        elif document_type in ["blood_report", "lab_report"]:
            return f"{expanded_title} Report"
        elif document_type in ["mri", "ct_scan", "xray"]:
            return f"{expanded_title} Scan"
        else:
            return f"{expanded_title} {doc_display}"
    
    @staticmethod
    def _expand_abbreviations(text: str) -> str:
        """Expand common medical abbreviations in text."""
        if not text:
            return ""
        
        expanded = text
        
        # Replace abbreviations
        for abbr, full in TitleGenerator.TITLE_ABBREVIATIONS.items():
            # Case-insensitive replacement
            import re
            pattern = r'\b' + abbr + r'\b'
            expanded = re.sub(pattern, full, expanded, flags=re.IGNORECASE)
        
        # Also use condition normalizer for additional expansions
        expanded = ConditionNormalizer.normalize(expanded)
        
        return expanded
