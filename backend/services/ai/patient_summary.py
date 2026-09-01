import json
from typing import Dict, Any

def generate_ai_patient_summary(patient_id: int, medical_records: list) -> Dict[str, Any]:
    """
    Generates a structured AI summary of a patient's medical history.
    This is a mocked version of an AI engine.
    In a real-world scenario, this would call an LLM with the medical records text.
    """
    
    # Mocked AI logic: Aggregate past conditions and medicines
    past_diseases = set()
    current_medicines = set()
    allergies = set()
    
    for record in medical_records:
        if record.probable_conditions:
            conditions = [c.strip() for c in record.probable_conditions.split(",")]
            past_diseases.update(conditions)
        if record.detected_medicines:
            medicines = [m.strip() for m in record.detected_medicines.split(",")]
            current_medicines.update(medicines)
    
    risk_indicators = []
    if "Hypertension" in past_diseases:
        risk_indicators.append("High Blood Pressure Risk")
    if "Diabetes" in past_diseases:
        risk_indicators.append("High Blood Sugar Risk")
        
    health_score = 100 - (len(past_diseases) * 5) - (len(risk_indicators) * 10)
    health_score = max(health_score, 0)
    
    return {
        "patient_id": patient_id,
        "summary": "Patient has a history of " + ", ".join(past_diseases) if past_diseases else "No major history.",
        "past_diseases": list(past_diseases),
        "current_medicines": list(current_medicines),
        "allergies": list(allergies), # Ideally fetched from Patient model
        "risk_indicators": risk_indicators,
        "health_score": health_score,
        "generated_at": "now" # Replace with actual timestamp in router
    }
