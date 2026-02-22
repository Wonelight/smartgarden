-- ============================================================
-- V2: Agro-Physics Schema Expansion
-- Smart Irrigation System — Predictive Model Upgrade
-- ============================================================

-- ========================
-- 1. NEW TABLES
-- ========================

-- Crop Library: Static knowledge base for crop physiology (FAO-56)
CREATE TABLE IF NOT EXISTS crop_library (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    kc_ini FLOAT NOT NULL COMMENT 'Crop coefficient - initial stage',
    kc_mid FLOAT NOT NULL COMMENT 'Crop coefficient - mid-season stage',
    kc_end FLOAT NOT NULL COMMENT 'Crop coefficient - late/end stage',
    stage_ini_days INT NOT NULL COMMENT 'Duration of initial growth stage (days)',
    stage_dev_days INT NOT NULL COMMENT 'Duration of development stage (days)',
    stage_mid_days INT NOT NULL COMMENT 'Duration of mid-season stage (days)',
    stage_end_days INT NOT NULL COMMENT 'Duration of late-season stage (days)',
    max_root_depth FLOAT NOT NULL COMMENT 'Maximum root depth (mm)',
    depletion_fraction FLOAT NOT NULL COMMENT 'Allowable depletion fraction (p), 0-1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT uk_crop_library_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Soil Library: Static knowledge base for soil hydraulic properties
CREATE TABLE IF NOT EXISTS soil_library (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    field_capacity FLOAT NOT NULL COMMENT 'Field Capacity (FC) in %',
    wilting_point FLOAT NOT NULL COMMENT 'Permanent Wilting Point (PWP) in %',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT uk_soil_library_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crop Season: Active farming cycles linking Device ↔ Crop ↔ Soil
CREATE TABLE IF NOT EXISTS crop_season (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    crop_id BIGINT NOT NULL,
    soil_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    initial_root_depth FLOAT NOT NULL COMMENT 'Initial root depth (mm)',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE or COMPLETED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_crop_season_device FOREIGN KEY (device_id) REFERENCES devices(id),
    CONSTRAINT fk_crop_season_crop FOREIGN KEY (crop_id) REFERENCES crop_library(id),
    CONSTRAINT fk_crop_season_soil FOREIGN KEY (soil_id) REFERENCES soil_library(id),
    INDEX idx_crop_season_device_status (device_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Daily Water Balance: Daily ledger for Water Balance calculations
CREATE TABLE IF NOT EXISTS daily_water_balance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    season_id BIGINT NOT NULL,
    date DATE NOT NULL,
    crop_age INT NOT NULL COMMENT 'Age of crop in days since planting',
    et0_value FLOAT COMMENT 'Reference Evapotranspiration ET₀ (mm/day)',
    kc_current FLOAT COMMENT 'Current crop coefficient Kc',
    etc_value FLOAT COMMENT 'Crop Evapotranspiration ETc = ET₀ × Kc (mm/day)',
    effective_rain FLOAT COMMENT 'Effective rainfall (mm)',
    irrigation_amount FLOAT COMMENT 'Irrigation applied (mm)',
    dc_value FLOAT COMMENT 'Root Zone Depletion DC (mm)',
    recommendation TEXT COMMENT 'Text recommendation for irrigation',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    CONSTRAINT fk_daily_water_balance_season FOREIGN KEY (season_id) REFERENCES crop_season(id),
    CONSTRAINT uk_daily_water_balance_season_date UNIQUE (season_id, date),
    INDEX idx_daily_water_balance_season_date (season_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================
-- 2. ALTER EXISTING TABLES
-- ========================

-- WeatherData: Add Penman-Monteith input columns
ALTER TABLE weather_data
    ADD COLUMN solar_radiation FLOAT NULL COMMENT 'Solar radiation (MJ/m²/day)' AFTER uv_index,
    ADD COLUMN sunshine_hours FLOAT NULL COMMENT 'Sunshine duration (hours)' AFTER solar_radiation,
    ADD COLUMN wind_speed_2m FLOAT NULL COMMENT 'Wind speed at 2m height (m/s)' AFTER sunshine_hours,
    ADD COLUMN atmospheric_pressure FLOAT NULL COMMENT 'Atmospheric pressure (kPa)' AFTER wind_speed_2m;

-- Device: Add geographic location for ET₀ calculation
ALTER TABLE devices
    ADD COLUMN latitude DOUBLE NULL COMMENT 'Latitude in decimal degrees' AFTER last_online,
    ADD COLUMN altitude DOUBLE NULL COMMENT 'Altitude in meters above sea level' AFTER latitude;

-- ML Prediction: Add agro-physics input features
ALTER TABLE ml_prediction
    ADD COLUMN dc_input FLOAT NULL COMMENT 'Calculated root zone deficit (mm)' AFTER anfis_accuracy,
    ADD COLUMN plant_age_input INT NULL COMMENT 'Plant age in days' AFTER dc_input;

-- ========================
-- 3. SEED DATA
-- ========================

-- Common crops (FAO-56 reference values)
INSERT INTO crop_library (name, kc_ini, kc_mid, kc_end, stage_ini_days, stage_dev_days, stage_mid_days, stage_end_days, max_root_depth, depletion_fraction) VALUES
    ('Cà chua (Tomato)', 0.60, 1.15, 0.80, 30, 40, 40, 25, 1000, 0.40),
    ('Lúa (Rice)', 1.05, 1.20, 0.90, 30, 30, 60, 30, 600, 0.20),
    ('Ngô (Corn)', 0.30, 1.20, 0.60, 20, 35, 40, 30, 1500, 0.55),
    ('Xà lách (Lettuce)', 0.70, 1.00, 0.95, 20, 30, 15, 10, 300, 0.30),
    ('Ớt (Pepper)', 0.60, 1.05, 0.90, 25, 35, 40, 20, 800, 0.30),
    ('Dưa hấu (Watermelon)', 0.40, 1.00, 0.75, 20, 30, 30, 15, 1000, 0.40),
    ('Đậu xanh (Mung Bean)', 0.40, 1.05, 0.60, 15, 25, 25, 10, 600, 0.45),
    ('Rau muống (Water Spinach)', 0.70, 1.00, 0.95, 10, 15, 20, 10, 300, 0.25)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Common soil types (typical Vietnamese agricultural soils)
INSERT INTO soil_library (name, field_capacity, wilting_point) VALUES
    ('Đất cát (Sandy)', 15.0, 5.0),
    ('Đất cát pha (Sandy Loam)', 22.0, 10.0),
    ('Đất thịt (Loam)', 30.0, 15.0),
    ('Đất thịt pha sét (Clay Loam)', 36.0, 20.0),
    ('Đất sét (Clay)', 42.0, 25.0),
    ('Đất phù sa (Alluvial)', 35.0, 17.0)
ON DUPLICATE KEY UPDATE name = VALUES(name);
