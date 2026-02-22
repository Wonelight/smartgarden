-- ============================================================
-- V3: Device Water Balance State
-- Smart Irrigation System — Persistent Water Balance State Storage
-- ============================================================

-- Device Water Balance State: Real-time state per device for multi-layer water balance
-- Replaces in-memory storage with persistent MySQL storage
CREATE TABLE IF NOT EXISTS device_water_balance_state (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    
    -- Shallow layer state
    shallow_depletion FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Depletion in shallow layer (mm)',
    shallow_taw FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Total Available Water in shallow layer (mm)',
    shallow_raw FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Readily Available Water in shallow layer (mm)',
    
    -- Deep layer state
    deep_depletion FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Depletion in deep layer (mm)',
    deep_taw FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Total Available Water in deep layer (mm)',
    deep_raw FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Readily Available Water in deep layer (mm)',
    
    -- Irrigation tracking
    last_irrigation FLOAT NOT NULL DEFAULT 0.0 COMMENT 'Last irrigation amount (mm)',
    
    -- Soil moisture history for trend calculation (JSON array of {timestamp, value})
    -- Format: [{"timestamp": "2024-01-01T10:00:00", "value": 45.5}, ...]
    soil_moist_history JSON NULL COMMENT 'Array of recent soil moisture readings for trend',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    
    CONSTRAINT fk_device_wb_state_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    CONSTRAINT uk_device_wb_state_device UNIQUE (device_id),
    INDEX idx_device_wb_state_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Real-time water balance state per device for multi-layer calculations';
