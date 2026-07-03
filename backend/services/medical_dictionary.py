"""
Offline Medical Dictionary
Lightweight knowledge base for medicine and disease validation
"""

from typing import Set, Dict


class MedicalDictionary:
    """Offline medical dictionary for validation and normalization."""
    
    # Common Indian medicine names (generic and brand)
    INDIAN_MEDICINES: Set[str] = {
        # Antibiotics
        'azithromycin', 'azithral', 'azee', 'azomax', 'zithromax',
        'amoxicillin', 'amoxil', 'mox', 'novamox', 'amoxycillin',
        'augmentin', 'amoxiclav', 'clavam',
        'cefuroxime', 'cefurox', 'zinacef', 'zinnat',
        'ceftriaxone', 'ceftriax', 'rocephin', 'taxim',
        'ciprofloxacin', 'cipro', 'cifran', 'ciplox',
        'levofloxacin', 'levoflox', 'levoday', 'levobact',
        'moxifloxacin', 'moxiflo', 'moxicip', 'avelox',
        'doxycycline', 'doxy', 'doxyl', 'doxy-1',
        'metronidazole', 'metrogyl', 'flagyl', 'metron',
        'clarithromycin', 'clarithro', 'claribid',
        'erythromycin', 'erythro', 'erycin',
        'ofloxacin', 'oflo', 'oflox', 'zanocin',
        'norfloxacin', 'norflo', 'norflox',
        
        # Painkillers/NSAIDs
        'paracetamol', 'acetaminophen', 'crocin', 'dolo', 'calpol', 'tylenol',
        'ibuprofen', 'ibupro', 'brufen', 'motrin', 'advil',
        'diclofenac', 'diclo', 'voveran', 'volini', 'cataflam',
        'naproxen', 'napro', 'naprosyn',
        'ketorolac', 'ketoro', 'ketorol', 'toradol',
        'tramadol', 'trama', 'tramazac', 'ultram',
        'morphine', 'morphin',
        'codeine', 'codein',
        'aceclofenac', 'aceclo', 'hifenac',
        'nimesulide', 'nimesu', 'nise', 'nimulid',
        
        # PPIs/Antacids
        'omeprazole', 'omepra', 'omez', 'prilosec',
        'pantoprazole', 'pantopra', 'pantocid', 'protonix',
        'rabeprazole', 'rabepra', 'rabicip', 'aciphex',
        'esomeprazole', 'esomepra', 'nexium',
        'ranitidine', 'ranitid', 'zantac',
        'famotidine', 'famotid', 'pepcid',
        'antacid', 'gelusil', 'digene',
        
        # Diabetes medications
        'metformin', 'metfor', 'glycomet', 'glucophage',
        'glimepiride', 'glimepi', 'amaryl',
        'sitagliptin', 'sitaglip', 'januvia',
        'vildagliptin', 'vildaglip', 'galvus',
        'insulin', 'insulatard', 'novorapid', 'humulin',
        'glipizide', 'glipiz', 'glucotrol',
        'glyburide', 'glybur', 'diabeta',
        'pioglitazone', 'pioglita', 'actos',
        'rosiglitazone', 'rosiglita', 'avandia',
        
        # Cardiovascular
        'amlodipine', 'amlodip', 'amlong', 'norvasc',
        'nifedipine', 'nifedip', 'adalat',
        'enalapril', 'enala', 'vasotec',
        'lisinopril', 'lisinop', 'prinivil', 'zestril',
        'ramipril', 'ramip', 'altace',
        'losartan', 'losar', 'cozaar',
        'telmisartan', 'telmisar', 'micardis',
        'valsartan', 'valsa', 'diovan',
        'hydrochlorothiazide', 'hydrochlo', 'hydrodiuril',
        'furosemide', 'furose', 'lasix',
        'spironolactone', 'spironol', 'aldactone',
        'digoxin', 'digo', 'lanoxin',
        'atorvastatin', 'atorva', 'lipitor',
        'simvastatin', 'simva', 'zocor',
        'rosuvastatin', 'rosuva', 'crestor',
        'fenofibrate', 'fenofi', 'tricor',
        
        # Antiplatelet/Anticoagulant
        'aspirin', 'ecosprin', 'disprin',
        'clopidogrel', 'clopi', 'plavix', 'clopivas',
        'warfarin', 'warfa', 'coumadin',
        'dabigatran', 'dabi', 'pradaxa',
        'rivaroxaban', 'rivar', 'xarelto',
        
        # Respiratory
        'montelukast', 'monteluk', 'singulair', 'montair',
        'salbutamol', 'salbu', 'albuterol', 'ventolin',
        'formoterol', 'formo', 'foradil',
        'budesonide', 'budeso', 'pulmicort',
        'fluticasone', 'fluti', 'flovent', 'flixotide',
        'prednisone', 'pred', 'prednisolone',
        'dexamethasone', 'dexa', 'decadron',
        'methylprednisolone', 'methyl', 'medrol',
        'hydrocortisone', 'hydro', 'cortef',
        
        # Thyroid
        'levothyroxine', 'levo', 'thyroxine', 'eltroxin', 'synthroid',
        
        # Neurological/Psychiatric
        'carbamazepine', 'carba', 'tegretol',
        'phenytoin', 'pheny', 'dilantin',
        'valproate', 'valpro', 'depakote',
        'gabapentin', 'gaba', 'neurontin',
        'pregabalin', 'prega', 'lyrica',
        'duloxetine', 'dulox', 'cymbalta',
        'venlafaxine', 'venla', 'effexor',
        'sertraline', 'sertra', 'zoloft',
        'fluoxetine', 'fluox', 'prozac',
        'escitalopram', 'escita', 'lexapro',
        'citalopram', 'cital', 'celexa',
        'paroxetine', 'parox', 'paxil',
        'alprazolam', 'alpra', 'xanax',
        'clonazepam', 'clona', 'klonopin',
        'diazepam', 'diaz', 'valium',
        'lorazepam', 'lora', 'ativan',
        'zolpidem', 'zolpi', 'ambien',
        'eszopiclone', 'eszo', 'lunesta',
        
        # Cognitive enhancers
        'donepezil', 'donep', 'aricept',
        'rivastigmine', 'riva', 'exelon',
        'memantine', 'mema', 'namenda',
        'piracetam', 'pirac', 'nootropil',
        'citicolin', 'citi', 'zynapse',
        
        # Vitamins/Supplements
        'multivitamin', 'multivit',
        'vitamin', 'vit',
        'calcium', 'calci', 'shelcal',
        'iron', 'ferrous', 'ferro',
        'folic', 'acid', 'folate',
        'omega', 'fish', 'oil',
        'protein', 'whey',
        'probiotic', 'lactobacillus',
        'vitamin d', 'cholecalciferol',
        'vitamin b12', 'cobalamin',
        'vitamin c', 'ascorbic',
        
        # Common Indian brands
        'dolo', 'crocin', 'calpol', 'voveran', 'volini',
        'omez', 'pantocid', 'rabicip', 'glycomet',
        'amlong', 'clopivas', 'ecosprin', 'montair',
        'ventolin', 'asthalin', 'seroflo',
        'thyronorm', 'eltroxin',
        'thyrox',
    }
    
    # WHO Essential Medicines (subset)
    WHO_ESSENTIAL: Set[str] = {
        'paracetamol', 'ibuprofen', 'morphine', 'codeine',
        'amoxicillin', 'amoxicillin-clavulanate', 'ceftriaxone',
        'azithromycin', 'ciprofloxacin', 'doxycycline',
        'metronidazole', 'clarithromycin',
        'omeprazole', 'ranitidine',
        'metformin', 'insulin', 'glimepiride',
        'amlodipine', 'enalapril', 'hydrochlorothiazide',
        'furosemide', 'digoxin',
        'aspirin', 'warfarin',
        'salbutamol', 'budesonide', 'prednisone',
        'levothyroxine',
        'carbamazepine', 'phenytoin', 'diazepam',
        'gabapentin',
        'fluoxetine', 'sertraline',
        'donepezil',
        'multivitamin', 'calcium', 'iron', 'folic acid',
    }
    
    # Body parts and organs (NEVER medicines)
    BODY_PARTS: Set[str] = {
        'heart', 'lungs', 'abdomen', 'stomach', 'liver', 'kidney', 'brain',
        'chest', 'thorax', 'spine', 'neck', 'head', 'eyes', 'ears', 'nose',
        'throat', 'skin', 'bone', 'joint', 'muscle', 'nerve', 'blood',
        'artery', 'vein', 'uterus', 'ovary', 'prostate', 'bladder', 'intestine',
        'colon', 'rectum', 'pelvis', 'leg', 'arm', 'hand', 'foot', 'toe',
        'finger', 'thumb', 'wrist', 'ankle', 'knee', 'elbow', 'shoulder',
        'hip', 'breast', 'testicle', 'penis', 'vagina', 'cervix',
        'pancreas', 'spleen', 'gallbladder', 'appendix', 'thyroid',
        'adrenal', 'pituitary', 'hypothalamus', 'cerebellum', 'cerebrum',
        'cornea', 'retina', 'pupil', 'iris', 'lens', 'eardrum',
        'tonsil', 'adenoid', 'sinus', 'nasal', 'oral', 'dental',
    }
    
    # Examination headings and findings (NEVER medicines)
    EXAMINATION_TERMS: Set[str] = {
        'physical', 'examination', 'temperature', 'pulse', 'blood pressure',
        'respiratory', 'rate', 'weight', 'height', 'bmi', 'oxygen', 'saturation',
        'consciousness', 'orientation', 'reflex', 'pupil', 'sound', 'murmur',
        'rhythm', 'regular', 'irregular', 'normal', 'abnormal',
        'clear', 'present', 'absent', 'positive', 'negative',
        'findings', 'impression', 'recommendation', 'news',
        'mri', 'ct', 'x-ray', 'ultrasound', 'ecg', 'eeg',
        'investigation', 'report', 'result', 'value', 'reference',
        'range', 'high', 'low', 'elevated', 'decreased',
        'history', 'complaint', 'symptom', 'sign',
    }
    
    # OCR garbage words (NEVER medicines)
    OCR_GARBAGE: Set[str] = {
        'padsx', 'oicgiprbnd', 'dep', 'news', 'fake', 'ple', 'ingot', 'paplegin',
        'rx', 'md', 'ph', 'reg', 'no', 'mob', 'mobile', 'contact',
        'voucher', 'cash', 'credit', 'debit', 'card', 'payment',
        'invoice', 'bill', 'amount', 'total', 'due', 'paid', 'balance',
        'life', 'line', 'clinic', 'hospital', 'doctor', 'patient', 'name', 'age',
        'sex', 'date', 'time', 'signature', 'advice', 'note', 'follow', 'up',
        'visit', 'lab', 'test', 'centre', 'center', 'road', 'street',
        'pharmacy', 'medical', 'store', 'address', 'city', 'state', 'pin', 'code',
    }
    
    # Common English words (unlikely to be medicines)
    COMMON_ENGLISH: Set[str] = {
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
        'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
        'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
        'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'mom', 'dad',
        'with', 'from', 'they', 'this', 'that', 'have', 'been', 'were', 'said',
        'each', 'which', 'their', 'time', 'will', 'about', 'if', 'would', 'there',
    }
    
    # Medicine suffixes (for validation)
    MEDICINE_SUFFIXES: Set[str] = {
        'mox', 'cillin', 'mycin', 'pril', 'sartan', 'statin', 'azole',
        'tidine', 'olol', 'prazole', 'vir', 'lam', 'pine', 'ipine',
        'astine', 'ast', 'tide', 'one', 'ine', 'ide', 'ate', 'ium',
        'azole', 'one', 'tin', 'xin', 'lin', 'ril', 'ban', 'tan',
    }
    
    # Medicine roots (for validation)
    MEDICINE_ROOTS: Set[str] = {
        'cef', 'azithro', 'amoxi', 'metform', 'glipi', 'sita', 'vilda',
        'atorva', 'simva', 'rosuva', 'amlodi', 'nife', 'enala', 'lisi',
        'ramip', 'losar', 'telmi', 'valsa', 'hydro', 'furose', 'spiro',
        'digi', 'aspir', 'clopi', 'warfa', 'dabi', 'rivar', 'monte',
        'salbu', 'formo', 'budeso', 'fluti', 'pred', 'dexa', 'methyl',
        'levo', 'thyro', 'carba', 'pheny', 'valpro', 'gaba',
        'prega', 'dulox', 'venla', 'sertra', 'fluox', 'escita', 'cital',
        'parox', 'alpra', 'clona', 'diaz', 'lora', 'zolpi', 'eszo',
        'donep', 'riva', 'mema', 'pirac', 'citi', 'omepra', 'pantop',
        'rabepra', 'esome', 'ranitid', 'famoti', 'metron', 'clarith',
        'erythro', 'cipro', 'levof', 'moxif', 'doxyc', 'nimesu', 'aceclo',
        'ketoro', 'trama', 'codei', 'ibupr', 'diclo', 'napro', 'parac',
    }
    
    @staticmethod
    def is_valid_medicine(name: str) -> tuple[bool, str]:
        """
        Validate if a name is likely a medicine.
        
        Returns:
            (is_valid, reason)
        """
        if not name:
            return False, "empty"
        
        name_lower = name.lower().strip()
        
        # Check length
        if len(name_lower) < 3:
            return False, "too_short"
        
        if len(name_lower) > 50:
            return False, "too_long"
        
        # Check for body parts
        if name_lower in MedicalDictionary.BODY_PARTS:
            return False, "body_part"
        
        # Check for examination terms
        if name_lower in MedicalDictionary.EXAMINATION_TERMS:
            return False, "examination_term"
        
        # Check for OCR garbage
        if name_lower in MedicalDictionary.OCR_GARBAGE:
            return False, "ocr_garbage"
        
        # Check for common English words
        if name_lower in MedicalDictionary.COMMON_ENGLISH:
            return False, "common_english"
        
        # Check if mostly symbols
        alpha_count = sum(1 for c in name_lower if c.isalpha())
        if alpha_count < len(name_lower) * 0.5:
            return False, "mostly_symbols"
        
        # Check if it's a known medicine
        if name_lower in MedicalDictionary.INDIAN_MEDICINES:
            return True, "known_indian_medicine"
        
        if name_lower in MedicalDictionary.WHO_ESSENTIAL:
            return True, "who_essential"
        
        # Check medicine suffixes
        if any(name_lower.endswith(suffix) for suffix in MedicalDictionary.MEDICINE_SUFFIXES):
            return True, "medicine_suffix_match"
        
        # Check medicine roots
        if any(root in name_lower for root in MedicalDictionary.MEDICINE_ROOTS):
            return True, "medicine_root_match"
        
        # Check capitalized pattern (brand name style)
        if re_match := __import__('re').match(r'^[A-Z][a-z]+(?:[+-][A-Z][a-z]+)*$', name):
            return True, "brand_name_pattern"
        
        # Default: suspicious
        return False, "unknown"
    
    @staticmethod
    def get_medicine_confidence(name: str) -> float:
        """
        Get confidence score for a medicine name (0-100).
        """
        is_valid, reason = MedicalDictionary.is_valid_medicine(name)
        
        if not is_valid:
            return 0.0
        
        name_lower = name.lower()
        
        # High confidence for known medicines
        if name_lower in MedicalDictionary.WHO_ESSENTIAL:
            return 95.0
        
        if name_lower in MedicalDictionary.INDIAN_MEDICINES:
            return 85.0
        
        # Medium confidence for pattern matches
        if reason == "medicine_suffix_match":
            return 70.0
        
        if reason == "medicine_root_match":
            return 65.0
        
        if reason == "brand_name_pattern":
            return 60.0
        
        return 50.0  # Default low confidence
    
    @staticmethod
    def fuzzy_correct(name: str) -> str:
        """
        Attempt to correct minor OCR spelling mistakes using fuzzy matching.
        """
        import difflib
        
        name_lower = name.lower().strip()
        
        # Find close matches in known medicines
        all_medicines = MedicalDictionary.INDIAN_MEDICINES | MedicalDictionary.WHO_ESSENTIAL
        
        matches = difflib.get_close_matches(name_lower, all_medicines, n=1, cutoff=0.8)
        
        if matches:
            return matches[0]
        
        return name
