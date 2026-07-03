"""
Condition Normalizer Module
Normalizes disease/condition names to standard ICD-friendly format
"""

from typing import Dict, Set


class ConditionNormalizer:
    """Normalizes disease and condition names."""
    
    # Abbreviation mappings
    ABBREVIATION_MAP: Dict[str, str] = {
        # COVID-19 variants
        'covid': 'COVID-19',
        'coronavirus': 'COVID-19',
        'coronavirus disease': 'COVID-19',
        'sars-cov-2': 'COVID-19',
        
        # Gastrointestinal
        'acute ge': 'Acute Gastroenteritis',
        'ge': 'Gastroenteritis',
        'gerd': 'Gastroesophageal Reflux Disease',
        'ibd': 'Inflammatory Bowel Disease',
        'ibs': 'Irritable Bowel Syndrome',
        
        # Cardiovascular
        'htn': 'Hypertension',
        'bp': 'Blood Pressure',
        'cad': 'Coronary Artery Disease',
        'mi': 'Myocardial Infarction',
        'chf': 'Congestive Heart Failure',
        'afib': 'Atrial Fibrillation',
        'cva': 'Cerebrovascular Accident',
        'tia': 'Transient Ischemic Attack',
        
        # Diabetes
        'dm': 'Diabetes Mellitus',
        'dm type 1': 'Type 1 Diabetes Mellitus',
        'dm type 2': 'Type 2 Diabetes Mellitus',
        't1dm': 'Type 1 Diabetes Mellitus',
        't2dm': 'Type 2 Diabetes Mellitus',
        'niddm': 'Type 2 Diabetes Mellitus',
        'iddm': 'Type 1 Diabetes Mellitus',
        
        # Respiratory
        'copd': 'Chronic Obstructive Pulmonary Disease',
        'uri': 'Upper Respiratory Infection',
        'lri': 'Lower Respiratory Infection',
        'pneumonia': 'Pneumonia',
        'tb': 'Tuberculosis',
        
        # Neurological
        'cva': 'Stroke',
        'tia': 'Transient Ischemic Attack',
        'seizure disorder': 'Epilepsy',
        
        # Renal
        'ckd': 'Chronic Kidney Disease',
        'aki': 'Acute Kidney Injury',
        'uti': 'Urinary Tract Infection',
        
        # Hepatic
        'hbv': 'Hepatitis B',
        'hcv': 'Hepatitis C',
        'aldf': 'Acute Liver Failure',
        'clf': 'Chronic Liver Failure',
        
        # Hematologic
        'anemia': 'Anemia',
        'dvt': 'Deep Vein Thrombosis',
        'pe': 'Pulmonary Embolism',
        
        # Endocrine
        'thyroid disorder': 'Thyroid Disease',
        'hypothyroid': 'Hypothyroidism',
        'hyperthyroid': 'Hyperthyroidism',
        
        # Infectious
        'hiv': 'Human Immunodeficiency Virus',
        'aids': 'Acquired Immunodeficiency Syndrome',
        
        # General
        'r/a': 'Referred for',
        'r/o': 'Rule out',
        'd/d': 'Differential diagnosis',
    }
    
    # Common misspellings and corrections
    SPELLING_CORRECTIONS: Dict[str, str] = {
        'diabetis': 'Diabetes',
        'diabetese': 'Diabetes',
        'hipertension': 'Hypertension',
        'hypertention': 'Hypertension',
        'arthritis': 'Arthritis',
        'asthama': 'Asthma',
        'asma': 'Asthma',
        'pneumonia': 'Pneumonia',
        'pnumonia': 'Pneumonia',
        'gastroenteritis': 'Gastroenteritis',
        'gastroentritis': 'Gastroenteritis',
        'cardiac': 'Cardiac',
        'cardiac arrest': 'Cardiac Arrest',
        'myocardial infarction': 'Myocardial Infarction',
        'myocardial infarction': 'Myocardial Infarction',
    }
    
    @staticmethod
    def normalize(condition: str) -> str:
        """
        Normalize a condition name to standard format.
        
        Args:
            condition: Raw condition name
            
        Returns:
            Normalized condition name
        """
        if not condition:
            return ""
        
        # Remove common prefixes
        condition = condition.replace("Possible related condition:", "").strip()
        condition = condition.replace("Confirmed diagnosis:", "").strip()
        condition = condition.replace("Diagnosis:", "").strip()
        
        # Convert to title case
        condition = condition.strip().title()
        
        # Check abbreviation map
        condition_lower = condition.lower()
        for abbr, full in ConditionNormalizer.ABBREVIATION_MAP.items():
            if abbr.lower() in condition_lower:
                return full
        
        # Apply spelling corrections
        for wrong, correct in ConditionNormalizer.SPELLING_CORRECTIONS.items():
            if wrong.lower() in condition_lower:
                return correct
        
        return condition
    
    @staticmethod
    def normalize_conditions(conditions: list[str]) -> list[str]:
        """
        Normalize a list of conditions.
        
        Args:
            conditions: List of raw condition names
            
        Returns:
            List of normalized condition names
        """
        normalized = []
        seen = set()
        
        for condition in conditions:
            norm = ConditionNormalizer.normalize(condition)
            if norm and norm not in seen:
                seen.add(norm)
                normalized.append(norm)
        
        return normalized
    
    @staticmethod
    def get_icd_friendly_name(condition: str) -> str:
        """
        Convert condition to ICD-friendly name.
        
        Args:
            condition: Condition name
            
        Returns:
            ICD-friendly name
        """
        normalized = ConditionNormalizer.normalize(condition)
        
        # Additional ICD-specific mappings
        icd_mappings = {
            'High Blood Pressure': 'Essential Hypertension',
            'High BP': 'Essential Hypertension',
            'Sugar': 'Diabetes Mellitus',
            'High Sugar': 'Diabetes Mellitus',
            'Thyroid Problem': 'Thyroid Disorder',
            'Heart Attack': 'Acute Myocardial Infarction',
            'Brain Stroke': 'Ischemic Stroke',
            'Lung Infection': 'Pneumonia',
            'Stomach Infection': 'Gastroenteritis',
            'Kidney Failure': 'Chronic Kidney Disease',
            'Liver Problem': 'Liver Disease',
        }
        
        for key, value in icd_mappings.items():
            if key.lower() in normalized.lower():
                return value
        
        return normalized
