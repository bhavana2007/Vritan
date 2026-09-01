ALTER TABLE medicines_master
    ADD COLUMN IF NOT EXISTS aliases TEXT NULL,
    ADD COLUMN IF NOT EXISTS dosage_form VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS strength VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS route VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS source_id VARCHAR(100) NULL;

ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS notes TEXT NULL;

SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'medicines_master'
      AND index_name = 'idx_medicines_master_generic_name'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_medicines_master_generic_name ON medicines_master (generic_name)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'medicines_master'
      AND index_name = 'idx_medicines_master_brand_name'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_medicines_master_brand_name ON medicines_master (brand_name)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'medicines_master'
      AND index_name = 'idx_medicines_master_source_id'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_medicines_master_source_id ON medicines_master (source, source_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'medicines_master'
      AND index_name = 'ft_medicines_master_search'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE FULLTEXT INDEX ft_medicines_master_search ON medicines_master (name, generic_name, brand_name, aliases, manufacturer)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
