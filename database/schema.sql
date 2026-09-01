CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    password VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    patient_uid VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL UNIQUE,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    blood_group VARCHAR(10) NULL,
    height FLOAT NULL,
    weight FLOAT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_patients_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doctors (
    user_id INT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    hospital VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doctors_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    record_type VARCHAR(20) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT NOT NULL,
    notes TEXT NULL,
    extracted_text TEXT NULL,
    cleaned_text TEXT NULL,
    detected_medicines TEXT NULL,
    probable_conditions TEXT NULL,
    ai_structured_data TEXT NULL,
    confidence_score FLOAT NULL,
    ai_summary TEXT NULL,
    document_type VARCHAR(50) NULL,
    classification_confidence FLOAT NULL,
    classification_reason TEXT NULL,
    ocr_quality_score FLOAT NULL,
    processing_time FLOAT NULL,
    ai_version VARCHAR(20) NULL DEFAULT 'v2.0',
    schema_validation_passed BOOLEAN NULL,
    validation_errors TEXT NULL,
    CONSTRAINT fk_medical_records_patient_id
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_medical_records_uploaded_by
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_medical_records_patient_id (patient_id),
    INDEX idx_medical_records_document_type (document_type)
);

CREATE TABLE IF NOT EXISTS access_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    CONSTRAINT fk_access_requests_patient_id
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_access_requests_doctor_id
        FOREIGN KEY (doctor_id) REFERENCES doctors(user_id)
        ON DELETE CASCADE,
    INDEX idx_access_requests_patient_id (patient_id),
    INDEX idx_access_requests_doctor_id (doctor_id),
    INDEX idx_access_requests_status (status)
);

CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_admins_email (email)
);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS signature_image_url VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS medicines_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255) NULL,
    brand_name VARCHAR(255) NULL,
    aliases TEXT NULL,
    dosage_form VARCHAR(100) NULL,
    strength VARCHAR(100) NULL,
    unit VARCHAR(50) NULL,
    route VARCHAR(100) NULL,
    manufacturer VARCHAR(255) NULL,
    source VARCHAR(50) NULL,
    source_id VARCHAR(100) NULL,
    default_strength VARCHAR(100) NULL,
    default_unit VARCHAR(50) NULL,
    default_route VARCHAR(100) NULL,
    INDEX idx_medicines_master_name (name),
    INDEX idx_medicines_master_generic_name (generic_name),
    INDEX idx_medicines_master_brand_name (brand_name),
    INDEX idx_medicines_master_source_id (source, source_id),
    FULLTEXT INDEX ft_medicines_master_search (name, generic_name, brand_name, aliases, manufacturer)
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id VARCHAR(50) NOT NULL UNIQUE,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    chief_complaint TEXT NULL,
    clinical_findings TEXT NULL,
    diagnosis TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    notes TEXT NULL,
    doctor_advice TEXT NULL,
    lifestyle_recommendations TEXT NULL,
    follow_up_notes TEXT NULL,
    follow_up_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    vitals_blood_pressure VARCHAR(50) NULL,
    vitals_heart_rate INT NULL,
    vitals_temperature FLOAT NULL,
    vitals_sp02 INT NULL,
    vitals_height FLOAT NULL,
    vitals_weight FLOAT NULL,
    vitals_bmi FLOAT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    updated_by INT NULL,
    deleted_at TIMESTAMP NULL,
    deleted_by INT NULL,
    CONSTRAINT fk_prescriptions_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_prescriptions_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_prescriptions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_prescriptions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
    CONSTRAINT fk_prescriptions_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
    INDEX idx_prescriptions_prescription_id (prescription_id),
    INDEX idx_prescriptions_doctor_id (doctor_id),
    INDEX idx_prescriptions_patient_id (patient_id),
    INDEX idx_prescriptions_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS prescription_medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    route VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    food_instruction VARCHAR(100) NOT NULL,
    special_instruction TEXT NULL,
    CONSTRAINT fk_prescription_medicines_presc_id FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    INDEX idx_prescription_medicines_presc_id (prescription_id)
);

CREATE TABLE IF NOT EXISTS prescription_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actor_id INT NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_prescription_activities_presc_id FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_activities_actor_id FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_prescription_activities_presc_id (prescription_id)
);

CREATE TABLE IF NOT EXISTS prescription_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    editor_id INT NOT NULL,
    CONSTRAINT fk_prescription_audit_logs_presc_id FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_audit_logs_editor_id FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_prescription_audit_logs_presc_id (prescription_id)
);
