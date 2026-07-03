-- Migration for AI Pipeline v2.0
-- Adds new fields to medical_records table for production-grade AI processing

-- Add new columns to medical_records table
ALTER TABLE medical_records 
ADD COLUMN document_type VARCHAR(50) NULL AFTER ai_summary,
ADD COLUMN classification_confidence FLOAT NULL AFTER document_type,
ADD COLUMN classification_reason TEXT NULL AFTER classification_confidence,
ADD COLUMN ocr_quality_score FLOAT NULL AFTER classification_reason,
ADD COLUMN processing_time FLOAT NULL AFTER ocr_quality_score,
ADD COLUMN ai_version VARCHAR(20) NULL DEFAULT 'v2.0' AFTER processing_time,
ADD COLUMN schema_validation_passed BOOLEAN NULL AFTER ai_version,
ADD COLUMN validation_errors TEXT NULL AFTER schema_validation_passed;

-- Add index for document_type queries
CREATE INDEX idx_medical_records_document_type ON medical_records(document_type);

-- Update existing records to have default ai_version
UPDATE medical_records SET ai_version = 'v2.0' WHERE ai_version IS NULL;
