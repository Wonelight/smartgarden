-- ============================================================
-- V5: Depletion history for lag features (6h/12h/24h)
-- Lịch sử weighted depletion để backend tính depletion_trend_* và gửi trong payload AI
-- ============================================================

ALTER TABLE device_water_balance_state
    ADD COLUMN depletion_history JSON NULL
    COMMENT 'Lịch sử weighted depletion [{timestamp, value}] cho lag 6h/12h/24h'
    AFTER soil_moist_history;
