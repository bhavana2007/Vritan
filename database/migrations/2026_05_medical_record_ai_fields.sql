ALTER TABLE medical_records
    ADD COLUMN extracted_text TEXT NULL,
    ADD COLUMN cleaned_text TEXT NULL,
    ADD COLUMN detected_medicines TEXT NULL,
    ADD COLUMN probable_conditions TEXT NULL,
    ADD COLUMN ai_structured_data TEXT NULL;
