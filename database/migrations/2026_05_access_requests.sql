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
