"""
AI Summary Generator Module
Generates patient-friendly summaries from extracted medical data
"""

from typing import Dict, Any, List
from .condition_normalizer import ConditionNormalizer


class AISummaryGenerator:
    """Generates patient-friendly AI summaries."""
    
    @staticmethod
    def generate_summary(
        document_type: str,
        extracted_data: Dict[str, Any],
        medicines: List[Dict[str, str]],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """
        Generate a comprehensive patient-friendly summary.
        
        Args:
            document_type: Type of medical document
            extracted_data: Extracted data from Gemini
            medicines: List of medicines
            conditions: List of conditions
            doctor_name: Doctor name
            hospital: Hospital name
            
        Returns:
            Dictionary with summary components
        """
        summary_parts = {
            "summary": "",
            "diagnosis": "",
            "medicines": "",
            "doctor": "",
            "hospital": "",
            "important_observations": "",
            "recommended_followup": ""
        }
        
        # Generate summary based on document type
        if document_type == "prescription":
            summary_parts = AISummaryGenerator._generate_prescription_summary(
                extracted_data, medicines, conditions, doctor_name, hospital
            )
        elif document_type == "blood_report":
            summary_parts = AISummaryGenerator._generate_blood_report_summary(
                extracted_data, conditions, doctor_name, hospital
            )
        elif document_type == "mri":
            summary_parts = AISummaryGenerator._generate_mri_summary(
                extracted_data, conditions, doctor_name, hospital
            )
        elif document_type == "ct_scan":
            summary_parts = AISummaryGenerator._generate_ct_summary(
                extracted_data, conditions, doctor_name, hospital
            )
        elif document_type == "discharge_summary":
            summary_parts = AISummaryGenerator._generate_discharge_summary(
                extracted_data, medicines, conditions, doctor_name, hospital
            )
        else:
            summary_parts = AISummaryGenerator._generate_general_summary(
                document_type, extracted_data, medicines, conditions, doctor_name, hospital
            )
        
        return summary_parts
    
    @staticmethod
    def _generate_prescription_summary(
        extracted_data: Dict[str, Any],
        medicines: List[Dict[str, str]],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for prescription."""
        summary = "This is a prescription document with medication instructions."
        
        # Diagnosis
        diagnosis = extracted_data.get("diagnosis", "")
        if diagnosis:
            diagnosis = ConditionNormalizer.normalize(diagnosis)
            diagnosis_text = f"Diagnosis: {diagnosis}"
        else:
            diagnosis_text = "No specific diagnosis mentioned."
        
        # Medicines
        if medicines:
            med_list = []
            for med in medicines[:10]:  # Limit to 10 medicines
                name = med.get("name", "")
                dosage = med.get("dosage", "")
                duration = med.get("duration", "")
                med_str = name
                if dosage:
                    med_str += f" ({dosage})"
                if duration:
                    med_str += f" for {duration}"
                med_list.append(med_str)
            medicines_text = "Medicines prescribed: " + ", ".join(med_list)
        else:
            medicines_text = "No medicines extracted."
        
        # Doctor
        doctor_text = f"Prescribed by: {doctor_name}" if doctor_name else "Doctor name not available."
        
        # Hospital
        hospital_text = f"Hospital/Clinic: {hospital}" if hospital != "Unknown" else ""
        
        # Important observations
        instructions = extracted_data.get("instructions", [])
        if instructions:
            obs_text = "Important instructions: " + "; ".join(instructions[:5])
        else:
            obs_text = ""
        
        # Follow-up
        notes = extracted_data.get("notes", [])
        if notes:
            followup_text = "Follow-up: " + "; ".join(notes[:3])
        else:
            followup_text = ""
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
    
    @staticmethod
    def _generate_blood_report_summary(
        extracted_data: Dict[str, Any],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for blood report."""
        summary = "This is a blood test report."
        
        # Diagnosis/Findings
        parameters = extracted_data.get("parameters", [])
        abnormal = extracted_data.get("abnormal_values", [])
        
        if abnormal:
            diagnosis_text = "Abnormal values detected: " + ", ".join(abnormal[:5])
        elif parameters:
            diagnosis_text = f"Blood test with {len(parameters)} parameters analyzed."
        else:
            diagnosis_text = "Blood test report details available."
        
        medicines_text = "Not applicable for blood reports."
        
        doctor_text = f"Test performed at: {hospital}" if hospital != "Unknown" else ""
        hospital_text = ""
        
        # Important observations
        if parameters:
            param_summary = []
            for param in parameters[:5]:
                name = param.get("name", "")
                value = param.get("value", "")
                if name and value:
                    param_summary.append(f"{name}: {value}")
            obs_text = "Key results: " + "; ".join(param_summary)
        else:
            obs_text = ""
        
        followup_text = "Please consult your doctor for interpretation of results."
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
    
    @staticmethod
    def _generate_mri_summary(
        extracted_data: Dict[str, Any],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for MRI report."""
        body_part = extracted_data.get("body_part", "")
        findings = extracted_data.get("findings", "")
        impression = extracted_data.get("impression", "")
        
        summary = f"This is an MRI scan report of the {body_part}." if body_part else "This is an MRI scan report."
        
        diagnosis_text = impression if impression else findings if findings else "MRI scan completed."
        
        medicines_text = "Not applicable for MRI reports."
        
        doctor_text = f"Radiologist: {doctor_name}" if doctor_name else ""
        hospital_text = f"Facility: {hospital}" if hospital != "Unknown" else ""
        
        obs_text = findings if findings else ""
        
        followup_text = extracted_data.get("recommendation", "")
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
    
    @staticmethod
    def _generate_ct_summary(
        extracted_data: Dict[str, Any],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for CT scan report."""
        body_part = extracted_data.get("body_part", "")
        findings = extracted_data.get("findings", "")
        impression = extracted_data.get("impression", "")
        
        summary = f"This is a CT scan report of the {body_part}." if body_part else "This is a CT scan report."
        
        diagnosis_text = impression if impression else findings if findings else "CT scan completed."
        
        medicines_text = "Not applicable for CT scan reports."
        
        doctor_text = f"Radiologist: {doctor_name}" if doctor_name else ""
        hospital_text = f"Facility: {hospital}" if hospital != "Unknown" else ""
        
        obs_text = findings if findings else ""
        
        followup_text = extracted_data.get("recommendation", "")
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
    
    @staticmethod
    def _generate_discharge_summary(
        extracted_data: Dict[str, Any],
        medicines: List[Dict[str, str]],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for discharge summary."""
        diagnosis = extracted_data.get("diagnosis", "")
        procedures = extracted_data.get("procedures", [])
        follow_up = extracted_data.get("follow_up", "")
        
        summary = "This is a hospital discharge summary."
        
        diagnosis_text = f"Primary diagnosis: {diagnosis}" if diagnosis else "Discharge summary available."
        
        # Medicines
        if medicines:
            med_list = [med.get("name", "") for med in medicines[:10]]
            medicines_text = "Discharge medicines: " + ", ".join(med_list)
        else:
            medicines_text = "No discharge medicines listed."
        
        doctor_text = f"Attending doctor: {doctor_name}" if doctor_name else ""
        hospital_text = f"Hospital: {hospital}" if hospital != "Unknown" else ""
        
        # Important observations
        if procedures:
            obs_text = "Procedures performed: " + ", ".join(procedures[:5])
        else:
            obs_text = ""
        
        followup_text = follow_up if follow_up else ""
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
    
    @staticmethod
    def _generate_general_summary(
        document_type: str,
        extracted_data: Dict[str, Any],
        medicines: List[Dict[str, str]],
        conditions: List[str],
        doctor_name: str,
        hospital: str
    ) -> Dict[str, str]:
        """Generate summary for general medical reports."""
        summary = f"This is a {document_type.replace('_', ' ')} document."
        
        # Try to extract diagnosis or findings
        diagnosis = extracted_data.get("diagnosis") or extracted_data.get("findings") or extracted_data.get("impression", "")
        diagnosis_text = diagnosis if diagnosis else "Medical report details available."
        
        # Medicines
        if medicines:
            med_list = [med.get("name", "") for med in medicines[:5]]
            medicines_text = "Medicines mentioned: " + ", ".join(med_list)
        else:
            medicines_text = ""
        
        doctor_text = f"Doctor: {doctor_name}" if doctor_name else ""
        hospital_text = f"Facility: {hospital}" if hospital != "Unknown" else ""
        
        obs_text = ""
        followup_text = ""
        
        return {
            "summary": summary,
            "diagnosis": diagnosis_text,
            "medicines": medicines_text,
            "doctor": doctor_text,
            "hospital": hospital_text,
            "important_observations": obs_text,
            "recommended_followup": followup_text
        }
