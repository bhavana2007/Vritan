"""
Document-Specific Extraction Schemas and Prompts
Defines extraction strategies for each medical document type
"""

from typing import Dict, Any


# JSON schemas for each document type
EXTRACTION_SCHEMAS = {
    "prescription": {
        "required_fields": [],
        "optional_fields": [
            "doctor_name", "hospital", "specialization", "patient_name", "age", "gender", 
            "prescription_date", "diagnosis", "symptoms", "clinical_findings", 
            "medicines", "lab_parameters", "test_results", "advice", "follow_up_date", 
            "medical_history", "allergies", "confidence_scores"
        ],
        "schema": {
            "doctor_name": "string",
            "hospital": "string",
            "specialization": "string",
            "patient_name": "string",
            "age": "string",
            "gender": "string",
            "prescription_date": "string (YYYY-MM-DD or as written)",
            "diagnosis": "string",
            "symptoms": ["string"],
            "clinical_findings": ["string"],
            "medicines": [
                {
                    "name": "string",
                    "dosage": "string",
                    "frequency": "string (e.g. BD, TDS, OD, twice daily)",
                    "duration": "string (e.g. 5 days, 2 weeks)",
                    "food_instructions": "string (e.g. after food, before breakfast)",
                    "instructions": "string"
                }
            ],
            "lab_parameters": ["string"],
            "test_results": ["string"],
            "advice": ["string"],
            "follow_up_date": "string",
            "medical_history": ["string"],
            "allergies": ["string"],
            "confidence_scores": {
                "doctor_name": "integer (0-100)",
                "hospital": "integer (0-100)",
                "specialization": "integer (0-100)",
                "patient_name": "integer (0-100)",
                "diagnosis": "integer (0-100)",
                "medicines": "integer (0-100)"
            }
        }
    },
    "blood_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["test_name", "patient_name", "test_date", "parameters", "abnormal_values", "reference_ranges"],
        "schema": {
            "test_name": "string",
            "patient_name": "string",
            "test_date": "string",
            "parameters": [
                {
                    "name": "string",
                    "value": "string",
                    "unit": "string",
                    "reference_range": "string",
                    "is_abnormal": "boolean"
                }
            ],
            "abnormal_values": ["string"],
            "reference_ranges": {"string": "string"}
        }
    },
    "lab_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["test_name", "patient_name", "test_date", "specimen", "results", "notes"],
        "schema": {
            "test_name": "string",
            "patient_name": "string",
            "test_date": "string",
            "specimen": "string",
            "results": [
                {
                    "test": "string",
                    "result": "string",
                    "unit": "string",
                    "reference": "string"
                }
            ],
            "notes": ["string"]
        }
    },
    "radiology_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["exam_type", "body_part", "findings", "impression", "recommendation", "technique"],
        "schema": {
            "exam_type": "string",
            "body_part": "string",
            "technique": "string",
            "findings": "string",
            "impression": "string",
            "recommendation": "string"
        }
    },
    "mri": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["scan_type", "body_part", "sequences", "findings", "impression", "recommendation"],
        "schema": {
            "scan_type": "string",
            "body_part": "string",
            "sequences": ["string"],
            "findings": "string",
            "impression": "string",
            "recommendation": "string"
        }
    },
    "ct_scan": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["scan_type", "body_part", "contrast_used", "findings", "impression", "recommendation"],
        "schema": {
            "scan_type": "string",
            "body_part": "string",
            "contrast_used": "boolean",
            "findings": "string",
            "impression": "string",
            "recommendation": "string"
        }
    },
    "xray": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["view", "body_part", "findings", "impression", "recommendation"],
        "schema": {
            "view": "string",
            "body_part": "string",
            "findings": "string",
            "impression": "string",
            "recommendation": "string"
        }
    },
    "vaccination_record": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["patient_name", "vaccinations", "next_due_date", "notes"],
        "schema": {
            "patient_name": "string",
            "vaccinations": [
                {
                    "vaccine_name": "string",
                    "date_administered": "string",
                    "dose": "string",
                    "batch_number": "string"
                }
            ],
            "next_due_date": "string",
            "notes": ["string"]
        }
    },
    "discharge_summary": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["patient_name", "admission_date", "discharge_date", "diagnosis", "procedures", "medications", "follow_up", "disposition"],
        "schema": {
            "patient_name": "string",
            "admission_date": "string",
            "discharge_date": "string",
            "diagnosis": "string",
            "procedures": ["string"],
            "medications": [
                {
                    "name": "string",
                    "dosage": "string",
                    "duration": "string"
                }
            ],
            "follow_up": "string",
            "disposition": "string"
        }
    },
    "medical_certificate": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["patient_name", "certificate_type", "issue_date", "validity", "condition", "restrictions", "doctor_name"],
        "schema": {
            "patient_name": "string",
            "certificate_type": "string",
            "issue_date": "string",
            "validity": "string",
            "condition": "string",
            "restrictions": ["string"],
            "doctor_name": "string"
        }
    },
    "hospital_bill": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["hospital_name", "total_amount", "bill_date", "invoice_number", "patient_name", "itemized_charges", "payment_status"],
        "schema": {
            "hospital_name": "string",
            "invoice_number": "string",
            "patient_name": "string",
            "bill_date": "string",
            "total_amount": "string",
            "itemized_charges": [
                {
                    "description": "string",
                    "amount": "string"
                }
            ],
            "payment_status": "string"
        }
    },
    "insurance_document": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["document_type", "insurance_company", "policy_number", "claim_number", "patient_name", "coverage_details", "amount"],
        "schema": {
            "document_type": "string",
            "insurance_company": "string",
            "policy_number": "string",
            "claim_number": "string",
            "patient_name": "string",
            "coverage_details": "string",
            "amount": "string"
        }
    },
    "referral_letter": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["patient_name", "referring_doctor", "referred_to", "reason", "specialty", "notes"],
        "schema": {
            "patient_name": "string",
            "referring_doctor": "string",
            "referred_to": "string",
            "reason": "string",
            "specialty": "string",
            "notes": ["string"]
        }
    },
    "ecg_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["patient_name", "heart_rate", "rhythm", "pr_interval", "qrs_duration", "qt_interval", "findings", "impression"],
        "schema": {
            "patient_name": "string",
            "heart_rate": "string",
            "rhythm": "string",
            "pr_interval": "string",
            "qrs_duration": "string",
            "qt_interval": "string",
            "findings": "string",
            "impression": "string"
        }
    },
    "ultrasound_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["exam_type", "organ_system", "findings", "impression", "recommendation"],
        "schema": {
            "exam_type": "string",
            "organ_system": "string",
            "findings": "string",
            "impression": "string",
            "recommendation": "string"
        }
    },
    "general_medical_report": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["report_type", "patient_name", "doctor_name", "findings", "impression", "notes"],
        "schema": {
            "report_type": "string",
            "patient_name": "string",
            "doctor_name": "string",
            "findings": "string",
            "impression": "string",
            "notes": ["string"]
        }
    },
    "other_medical_document": {
        "required_fields": [],  # No strict requirements - Gemini is primary source of truth
        "optional_fields": ["document_type", "patient_name", "key_information", "notes"],
        "schema": {
            "document_type": "string",
            "patient_name": "string",
            "key_information": "string",
            "notes": ["string"]
        }
    }
}


def get_extraction_prompt(document_type: str, ocr_text: str) -> str:
    """
    Generate document-specific extraction prompt for Gemini.
    
    Args:
        document_type: Type of medical document
        ocr_text: Cleaned OCR text
        
    Returns:
        Prompt string for Gemini API
    """
    prompts = {
        "prescription": f"""
You are a medical AI assistant specializing in prescription extraction.

Extract ALL structured information from this prescription OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "doctor_name": "Dr. John Smith",
  "hospital": "City Hospital",
  "specialization": "Cardiology",
  "patient_name": "Jane Doe",
  "age": "34",
  "gender": "Female",
  "prescription_date": "2024-01-15",
  "diagnosis": "Respiratory infection",
  "symptoms": ["Fever", "Cough", "Sore throat"],
  "clinical_findings": ["BP 120/80", "Temp 101F"],
  "medicines": [
    {{
      "name": "Azithromycin",
      "dosage": "500mg",
      "frequency": "OD (Once daily)",
      "duration": "5 days",
      "food_instructions": "Take after food",
      "instructions": "Complete the full course"
    }}
  ],
  "lab_parameters": ["CBC", "CRP"],
  "test_results": ["Elevated WBC"],
  "advice": ["Avoid cold drinks"],
  "follow_up_date": "2024-01-20",
  "medical_history": ["Asthma"],
  "allergies": ["Penicillin"],
  "confidence_scores": {{
    "doctor_name": 98,
    "hospital": 87,
    "specialization": 95,
    "patient_name": 99,
    "diagnosis": 92,
    "medicines": 99
  }}
}}

CRITICAL RULES:
- Extract doctor name, hospital, and specialization from letterhead or signature.
- Extract patient name, age, gender.
- Extract prescription_date.
- Extract diagnosis, symptoms, clinical_findings, medical_history, and allergies.
- Extract ALL medicines with exact names, dosage, frequency, duration, food_instructions.
- Never extract body parts or lab values as medicines.
- Provide a confidence_score (0-100) integer for each key field in the confidence_scores object based on how clearly it was present in the OCR text.
- If a field is not found, use null for strings and [] for arrays.
- Return valid JSON ONLY, no markdown fences, no explanations.
""",

        "blood_report": f"""
You are a medical AI assistant specializing in blood report extraction.

Extract structured information from this blood test report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "test_name": "Complete Blood Count",
  "patient_name": "John Doe",
  "test_date": "2024-01-15",
  "parameters": [
    {{
      "name": "Hemoglobin",
      "value": "13.5",
      "unit": "g/dL",
      "reference_range": "13.0-17.0",
      "is_abnormal": false
    }}
  ],
  "abnormal_values": ["Low platelet count"],
  "reference_ranges": {{"Hemoglobin": "13.0-17.0 g/dL"}}
}}

CRITICAL RULES:
- Extract ALL test parameters with values, units, and reference ranges
- Mark is_abnormal as true if value is outside reference range
- Common parameters: Hemoglobin, RBC, WBC, Platelets, Sugar, Creatinine, Thyroid, etc.
- Return valid JSON only, no markdown, no explanations
""",

        "lab_report": f"""
You are a medical AI assistant specializing in laboratory report extraction.

Extract structured information from this lab report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "test_name": "Urine Culture",
  "patient_name": "John Doe",
  "test_date": "2024-01-15",
  "specimen": "Urine",
  "results": [
    {{
      "test": "Culture",
      "result": "No growth",
      "unit": "N/A",
      "reference": "No growth"
    }}
  ],
  "notes": ["Sample adequate"]
}}

CRITICAL RULES:
- Extract test name, specimen type, and all results
- Include units and reference values where available
- Return valid JSON only, no markdown, no explanations
""",

        "radiology_report": f"""
You are a medical AI assistant specializing in radiology report extraction.

Extract structured information from this radiology report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "exam_type": "X-Ray",
  "body_part": "Chest",
  "technique": "PA view",
  "findings": "Lungs are clear. No focal consolidation. Cardiac silhouette is normal.",
  "impression": "Normal chest X-ray",
  "recommendation": "No follow-up required"
}}

CRITICAL RULES:
- Extract exam type (X-Ray, CT, MRI), body part, and technique
- Extract detailed findings and impression
- Include recommendations if present
- Return valid JSON only, no markdown, no explanations
""",

        "mri": f"""
You are a medical AI assistant specializing in MRI report extraction.

Extract structured information from this MRI report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "scan_type": "MRI Brain",
  "body_part": "Brain",
  "sequences": ["T1", "T2", "FLAIR", "DWI"],
  "findings": "No abnormal signal intensity. Ventricles are normal.",
  "impression": "Normal MRI brain",
  "recommendation": "Correlate clinically"
}}

CRITICAL RULES:
- Extract scan type, body part, and MRI sequences
- Extract findings and impression
- Return valid JSON only, no markdown, no explanations
""",

        "ct_scan": f"""
You are a medical AI assistant specializing in CT scan report extraction.

Extract structured information from this CT scan report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "scan_type": "CT Chest",
  "body_part": "Chest",
  "contrast_used": true,
  "findings": "No pulmonary nodules. No pleural effusion.",
  "impression": "Normal CT chest",
  "recommendation": "Routine follow-up"
}}

CRITICAL RULES:
- Extract scan type, body part, and whether contrast was used
- Extract findings and impression
- Return valid JSON only, no markdown, no explanations
""",

        "xray": f"""
You are a medical AI assistant specializing in X-Ray report extraction.

Extract structured information from this X-Ray report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "view": "PA",
  "body_part": "Chest",
  "findings": "Clear lung fields. Normal cardiac silhouette.",
  "impression": "Normal chest X-ray",
  "recommendation": "No acute findings"
}}

CRITICAL RULES:
- Extract view (PA, AP, lateral) and body part
- Extract findings and impression
- Return valid JSON only, no markdown, no explanations
""",

        "vaccination_record": f"""
You are a medical AI assistant specializing in vaccination record extraction.

Extract structured information from this vaccination record OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "patient_name": "John Doe",
  "vaccinations": [
    {{
      "vaccine_name": "BCG",
      "date_administered": "2020-01-15",
      "dose": "Birth dose",
      "batch_number": "ABC123"
    }}
  ],
  "next_due_date": "2024-06-01",
  "notes": ["All vaccinations up to date"]
}}

CRITICAL RULES:
- Extract all vaccinations with dates and doses
- Include batch numbers if available
- Return valid JSON only, no markdown, no explanations
""",

        "discharge_summary": f"""
You are a medical AI assistant specializing in discharge summary extraction.

Extract structured information from this discharge summary OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "patient_name": "John Doe",
  "admission_date": "2024-01-10",
  "discharge_date": "2024-01-15",
  "diagnosis": "Pneumonia",
  "procedures": ["Chest X-ray", "Blood tests"],
  "medications": [
    {{
      "name": "Azithromycin",
      "dosage": "500mg",
      "duration": "5 days"
    }}
  ],
  "follow_up": "Review after 1 week",
  "disposition": "Discharged home"
}}

CRITICAL RULES:
- Extract admission and discharge dates
- Extract diagnosis, procedures, and discharge medications
- Include follow-up instructions
- Return valid JSON only, no markdown, no explanations
""",

        "medical_certificate": f"""
You are a medical AI assistant specializing in medical certificate extraction.

Extract structured information from this medical certificate OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "patient_name": "John Doe",
  "certificate_type": "Medical Fitness Certificate",
  "issue_date": "2024-01-15",
  "validity": "6 months",
  "condition": "Fit for duty",
  "restrictions": ["No heavy lifting for 2 weeks"],
  "doctor_name": "Dr. Smith"
}}

CRITICAL RULES:
- Extract certificate type (fitness, sick leave, etc.)
- Extract validity period and any restrictions
- Return valid JSON only, no markdown, no explanations
""",

        "hospital_bill": f"""
You are a medical AI assistant specializing in hospital bill extraction.

Extract structured information from this hospital bill OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "hospital_name": "City Hospital",
  "invoice_number": "INV-12345",
  "patient_name": "John Doe",
  "bill_date": "2024-01-15",
  "total_amount": "5000.00",
  "itemized_charges": [
    {{
      "description": "Room charges",
      "amount": "2000.00"
    }}
  ],
  "payment_status": "Paid"
}}

CRITICAL RULES:
- Extract hospital name, invoice number, and total amount
- Extract itemized charges if available
- Return valid JSON only, no markdown, no explanations
""",

        "insurance_document": f"""
You are a medical AI assistant specializing in insurance document extraction.

Extract structured information from this insurance document OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "document_type": "Insurance Claim",
  "insurance_company": "ABC Insurance",
  "policy_number": "POL-12345",
  "claim_number": "CLM-67890",
  "patient_name": "John Doe",
  "coverage_details": "Full coverage for hospitalization",
  "amount": "5000.00"
}}

CRITICAL RULES:
- Extract document type (claim, policy, etc.)
- Extract policy/claim numbers and coverage details
- Return valid JSON only, no markdown, no explanations
""",

        "referral_letter": f"""
You are a medical AI assistant specializing in referral letter extraction.

Extract structured information from this referral letter OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "patient_name": "John Doe",
  "referring_doctor": "Dr. Smith",
  "referred_to": "Dr. Johnson (Cardiologist)",
  "reason": "Chest pain evaluation",
  "specialty": "Cardiology",
  "notes": ["Urgent referral"]
}}

CRITICAL RULES:
- Extract referring and referred doctor names
- Extract reason for referral and specialty
- Return valid JSON only, no markdown, no explanations
""",

        "ecg_report": f"""
You are a medical AI assistant specializing in ECG report extraction.

Extract structured information from this ECG report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "patient_name": "John Doe",
  "heart_rate": "72 bpm",
  "rhythm": "Sinus rhythm",
  "pr_interval": "160 ms",
  "qrs_duration": "80 ms",
  "qt_interval": "400 ms",
  "findings": "Normal sinus rhythm",
  "impression": "Normal ECG"
}}

CRITICAL RULES:
- Extract heart rate, rhythm, and interval measurements
- Extract findings and impression
- Return valid JSON only, no markdown, no explanations
""",

        "ultrasound_report": f"""
You are a medical AI assistant specializing in ultrasound report extraction.

Extract structured information from this ultrasound report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "exam_type": "Abdominal Ultrasound",
  "organ_system": "Abdomen",
  "findings": "Liver is normal in size and echotexture. Gallbladder is normal.",
  "impression": "Normal abdominal ultrasound",
  "recommendation": "No follow-up required"
}}

CRITICAL RULES:
- Extract exam type and organ system examined
- Extract findings and impression
- Return valid JSON only, no markdown, no explanations
""",

        "general_medical_report": f"""
You are a medical AI assistant specializing in general medical report extraction.

Extract structured information from this medical report OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "report_type": "General Examination",
  "patient_name": "John Doe",
  "doctor_name": "Dr. Smith",
  "findings": "General examination normal",
  "impression": "No acute illness",
  "notes": ["Patient stable"]
}}

CRITICAL RULES:
- Extract report type and key findings
- Extract doctor and patient names if available
- Return valid JSON only, no markdown, no explanations
""",

        "other_medical_document": f"""
You are a medical AI assistant specializing in medical document extraction.

Extract structured information from this medical document OCR text.

OCR Text:
{ocr_text}

Return ONLY valid JSON with this exact shape:
{{
  "document_type": "Medical Document",
  "patient_name": "John Doe",
  "key_information": "Summary of document content",
  "notes": ["Additional notes"]
}}

CRITICAL RULES:
- Extract document type and key information
- Extract patient name if available
- Return valid JSON only, no markdown, no explanations
"""
    }

    return prompts.get(document_type, prompts["general_medical_report"])


def validate_schema(document_type: str, extracted_data: Dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Validate extracted data against the expected schema for the document type.
    
    Args:
        document_type: Type of medical document
        extracted_data: Data extracted by Gemini
        
    Returns:
        (is_valid, list_of_errors)
    """
    schema = EXTRACTION_SCHEMAS.get(document_type)
    if not schema:
        return True, []  # Unknown document type, pass validation

    errors = []

    # Check required fields
    for field in schema["required_fields"]:
        if field not in extracted_data or not extracted_data[field]:
            errors.append(f"Missing required field: {field}")

    return len(errors) == 0, errors
