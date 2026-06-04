ALTER TABLE doctors
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE doctors
SET verification_status = 'approved'
WHERE is_verified = TRUE
  AND verification_status = 'pending';
