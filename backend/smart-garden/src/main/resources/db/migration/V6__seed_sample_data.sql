-- ============================================================
-- V6: Sample data ~1k records for development/demo
-- Device, SensorData (~1000), Weather, CropSeason, WaterBalance, IrrigationConfig
-- Chạy sau khi schema đã có (devices, sensor_data, ... từ Hibernate hoặc V1).
-- ============================================================

-- 1. Device mẫu (Hà Nội, có tọa độ cho ET₀)
INSERT INTO devices (device_code, device_name, location, status, latitude, longitude, altitude, created_at, updated_at, deleted_at)
SELECT 'SG-001', 'Vườn mẫu Hà Nội', 'Hanoi', 'ONLINE', 21.03, 105.85, 12.0, NOW(), NOW(), NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM devices LIMIT 1);

-- Lấy device_id (device đầu tiên trong bảng)
SET @device_id = (SELECT id FROM devices ORDER BY id LIMIT 1);

-- 2. Sensor data ~1000 bản ghi (10 phút/lần ≈ 7 ngày)
INSERT INTO sensor_data (device_id, soil_moisture, soil_moisture_2, temperature, humidity, light_intensity, rain_detected, timestamp, created_at, updated_at, deleted_at)
SELECT
  @device_id,
  25.0 + (seq.n * 0.02) + (RAND() * 10 - 5),
  28.0 + (seq.n * 0.015) + (RAND() * 8 - 4),
  22.0 + (seq.n MOD 24) * 0.3 + (RAND() * 4 - 2),
  65.0 + (seq.n MOD 12) + (RAND() * 10 - 5),
  5000.0 + (seq.n MOD 24) * 800 + (RAND() * 2000),
  IF(RAND() < 0.05, 1, 0),
  DATE_SUB(NOW(), INTERVAL (1000 - seq.n) * 10 MINUTE),
  NOW(), NOW(), NULL
FROM (
  SELECT (a.n + b.n*10 + c.n*100 + d.n*1000) AS n
  FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a
  CROSS JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
  CROSS JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c
  CROSS JOIN (SELECT 0 n UNION SELECT 1) d
  WHERE (a.n + b.n*10 + c.n*100 + d.n*1000) < 1000
) seq
WHERE @device_id IS NOT NULL;

-- 3. Weather data (location = device location, cho predict payload)
INSERT INTO weather_data (location, temperature, humidity, precipitation, precipitation_probability, wind_speed, uv_index, forecast_time, solar_radiation, sunshine_hours, wind_speed_2m, atmospheric_pressure, created_at, updated_at, deleted_at)
SELECT 'Hanoi', 28.0, 72.0, 0.5, 0.2, 2.0, 8.0, NOW(), 22.0, 6.0, 2.0, 101.3, NOW(), NOW(), NULL
WHERE NOT EXISTS (SELECT 1 FROM weather_data WHERE location = 'Hanoi' LIMIT 1);

-- 4. Daily weather forecast (3 ngày tới)
INSERT INTO daily_weather_forecast (location, forecast_date, temp_min, temp_max, temp_avg, humidity_avg, wind_speed_avg, total_rain, precip_prob_avg, avg_clouds, created_at, updated_at, deleted_at)
VALUES
  ('Hanoi', CURDATE(), 24.0, 32.0, 28.0, 70.0, 2.0, 0.0, 0.2, 40.0, NOW(), NOW(), NULL),
  ('Hanoi', CURDATE() + INTERVAL 1 DAY, 25.0, 33.0, 29.0, 68.0, 2.2, 2.0, 0.3, 50.0, NOW(), NOW(), NULL),
  ('Hanoi', CURDATE() + INTERVAL 2 DAY, 24.0, 31.0, 27.5, 72.0, 1.8, 5.0, 0.4, 60.0, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE temp_avg = VALUES(temp_avg);

-- 5. Crop season (device + Lúa + Đất thịt từ V2 seed)
SET @crop_id = (SELECT id FROM crop_library WHERE name LIKE '%Lúa%' LIMIT 1);
SET @soil_id = (SELECT id FROM soil_library WHERE name LIKE '%thịt%' AND name NOT LIKE '%pha%' LIMIT 1);
INSERT INTO crop_season (device_id, crop_id, soil_id, start_date, initial_root_depth, status, created_at, updated_at, deleted_at)
SELECT @device_id, @crop_id, @soil_id, DATE_SUB(CURDATE(), INTERVAL 35 DAY), 0.1, 'ACTIVE', NOW(), NOW(), NULL
WHERE @device_id IS NOT NULL AND @crop_id IS NOT NULL AND @soil_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM crop_season WHERE device_id = @device_id AND status = 'ACTIVE');

-- 6. Water balance state (cho payload AI)
INSERT INTO device_water_balance_state (device_id, shallow_depletion, shallow_taw, shallow_raw, deep_depletion, deep_taw, deep_raw, last_irrigation, soil_moist_history, created_at, updated_at, deleted_at)
SELECT @device_id, 5.0, 25.0, 12.5, 8.0, 40.0, 20.0, 3.0, '[]', NOW(), NOW(), NULL
WHERE @device_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM device_water_balance_state WHERE device_id = @device_id);

-- 7. Irrigation config (bật AI để gọi predict)
INSERT INTO irrigation_config (device_id, soil_moisture_min, soil_moisture_max, soil_moisture_optimal, temp_min, temp_max, light_threshold, irrigation_duration_min, irrigation_duration_max, fuzzy_enabled, auto_mode, ai_enabled, created_at, updated_at, deleted_at)
SELECT @device_id, 20.0, 60.0, 40.0, 15.0, 35.0, 1000.0, 30, 300, 1, 1, 1, NOW(), NOW(), NULL
WHERE @device_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM irrigation_config WHERE device_id = @device_id);
