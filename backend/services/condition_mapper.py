# backend/services/condition_mapper.py

class ConditionMapper:
    def __init__(self):
        self.medicine_to_conditions = {
            # Diabetes medications
            "Metformin": ["Type 2 Diabetes"],
            "Glibenclamide": ["Type 2 Diabetes"],
            "Glimepiride": ["Type 2 Diabetes"],
            "Insulin": ["Diabetes"],
            "Sitagliptin": ["Type 2 Diabetes"],
            
            # Pain/Fever medications
            "Paracetamol": ["Fever", "Pain"],
            "Ibuprofen": ["Pain", "Inflammation"],
            "Diclofenac": ["Pain", "Inflammation"],
            
            # Antibiotics
            "Amoxicillin": ["Bacterial Infection"],
            "Azithromycin": ["Bacterial Infection"],
            "Ciprofloxacin": ["Bacterial Infection"],
            "Augmentin": ["Bacterial Infection"],
            "Doxycycline": ["Bacterial Infection"],
            
            # Allergy medications
            "Cetirizine": ["Allergy"],
            "Loratadine": ["Allergy"],
            "Fexofenadine": ["Allergy"],
            
            # Gastric medications
            "Pantoprazole": ["Gastric issues", "Acidity"],
            "Omeprazole": ["Gastric issues", "Acidity"],
            "Ranitidine": ["Gastric issues", "Acidity"],
            
            # Thyroid medications
            "Thyroxine": ["Hypothyroidism"],
            "Levothyroxine": ["Hypothyroidism"],
            
            # Cardiovascular medications
            "Amlodipine": ["Hypertension"],
            "Atenolol": ["Hypertension"],
            "Losartan": ["Hypertension"],
            
            # Supplements
            "Calcium": ["Calcium deficiency", "Bone health"],
            "Vitamin D3": ["Vitamin D deficiency", "Bone health"],
            "Iron": ["Anemia"],
            "Folic Acid": ["Anemia", "Pregnancy support"],
        }

    def map_medicines_to_conditions(self, extracted_medicines: list) -> dict:
        condition_counts = {}
        medicine_names = []
        
        for medicine in extracted_medicines:
            medicine_name = medicine.get("name", "").strip()
            if medicine_name:
                medicine_names.append(medicine_name)
                # Check for partial matches (case-insensitive)
                for med_key, conditions in self.medicine_to_conditions.items():
                    if med_key.lower() in medicine_name.lower() or medicine_name.lower() in med_key.lower():
                        for condition in conditions:
                            condition_counts[condition] = condition_counts.get(condition, 0) + 1
        
        # Calculate confidence based on number of medicines pointing to same condition
        candidate_conditions = []
        for condition, count in condition_counts.items():
            confidence = min(95, 60 + (count * 10))  # Base 60%, +10% per matching medicine
            candidate_conditions.append({
                "condition": condition,
                "confidence": confidence
            })
        
        # Sort by confidence
        candidate_conditions.sort(key=lambda x: x["confidence"], reverse=True)
        
        return {
            "possible_conditions": candidate_conditions,
            "medicines_analyzed": medicine_names
        }