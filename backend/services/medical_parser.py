# backend/services/medical_parser.py

import re

class MedicalParser:
    def __init__(self):
        pass

    def cleanup_ocr_text(self, ocr_text: str) -> str:
        # Remove OCR symbols and formatting artifacts
        cleaned_text = re.sub(r'[^a-zA-Z0-9\s,./()-]', '', ocr_text)
        
        # Split into lines
        lines = cleaned_text.split('\n')
        filtered_lines = []
        
        # Patterns to remove (clinic/hospital metadata)
        remove_patterns = [
            r'clinic', r'centre', r'center', r'road', r'street', r'phone',
            r'doctor', r'dr\.', r'reg', r'date', r'advice', r'rx', r'md',
            r'hospital', r'ph', r'pharmacy', r'medical store', r'store',
            r'no\.', r'contact', r'mob', r'mobile', r'address', r'city'
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Remove lines matching clinic/hospital patterns
            line_lower = line.lower()
            should_remove = False
            for pattern in remove_patterns:
                if re.search(pattern, line_lower):
                    should_remove = True
                    break
            
            if should_remove:
                continue
            
            # Remove short tokens (<3 chars)
            tokens = line.split()
            filtered_tokens = [t for t in tokens if len(t) >= 3]
            
            if filtered_tokens:
                filtered_lines.append(' '.join(filtered_tokens))
        
        # Remove duplicate lines
        unique_lines = []
        seen_lines = set()
        for line in filtered_lines:
            if line.lower() not in seen_lines:
                unique_lines.append(line)
                seen_lines.add(line.lower())
        
        cleaned_text = '\n'.join(unique_lines)
        
        # Normalize medicine spacing (e.g., "Para cetamol" -> "Paracetamol")
        cleaned_text = re.sub(r'(\b[A-Za-z]+)\s+([A-Za-z]+)\b', lambda m: m.group(1) + m.group(2) if len(m.group(2)) < 4 else m.group(0), cleaned_text)

        return cleaned_text

    def extract_medicines(self, cleaned_text: str) -> list:
        extracted_medicines = []
        
        # Common medicine name patterns (start with capital letter, contain medical-sounding terms)
        # Pattern: Medicine name (can have spaces, + for compounds) followed by optional strength/dosage
        medicine_pattern = re.compile(
            r'^([A-Z][a-zA-Z\s\+\-]+(?:\s+[A-Z][a-zA-Z\s\+\-]+)*)\s*(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|IU)?)?\s*(\d-\d-\d|\d-\d|\d+times?\s*(?:daily|day))?\s*(?:for\s*(\d+\s*(?:days|weeks)))?',
            re.IGNORECASE
        )
        
        # Non-medicine keywords to filter out
        non_medicine_keywords = [
            'life line', 'monitor', 'blood', 'sugar', 'regularly', 'thyroid',
            'diabetes', 'centre', 'clinic', 'hospital', 'doctor', 'patient',
            'name', 'age', 'sex', 'date', 'time', 'signature', 'advice',
            'note', 'follow', 'up', 'visit', 'report', 'lab', 'test'
        ]
        
        for line in cleaned_text.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # Skip lines that contain non-medicine keywords
            line_lower = line.lower()
            is_non_medicine = False
            for keyword in non_medicine_keywords:
                if keyword in line_lower:
                    is_non_medicine = True
                    break
            
            if is_non_medicine:
                continue
            
            # Try to match medicine pattern
            match = medicine_pattern.match(line)
            if match:
                name = match.group(1).strip() if match.group(1) else ""
                strength = match.group(2).strip() if match.group(2) else ""
                frequency = match.group(3).strip() if match.group(3) else ""
                duration = match.group(4).strip() if match.group(4) else ""
                
                # Validate medicine name (should be at least 3 chars and look like a medicine)
                if name and len(name) >= 3:
                    # Clean up the name
                    name = re.sub(r'\s+', ' ', name)
                    
                    extracted_medicines.append({
                        "name": name,
                        "dosage": strength or frequency or "",
                        "duration": duration or ""
                    })
        
        return extracted_medicines