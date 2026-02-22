-- ============================================================
-- V4: Soil infiltration ratio (shallow vs deep) by soil type
-- Tỷ lệ thẩm thấu phụ thuộc loại đất: cát thấm sâu hơn, sét giữ nhiều ở bề mặt
-- ============================================================

ALTER TABLE soil_library
    ADD COLUMN infiltration_shallow_ratio FLOAT NULL
    COMMENT 'Tỷ lệ nước mưa/tưới vào tầng nông (0-1). Deep = 1 - shallow. NULL = dùng mặc định 0.70'
    AFTER wilting_point;

-- Giá trị điển hình theo loại đất (shallow_ratio: phần vào tầng nông)
-- Cát: thấm nhanh xuống sâu → ít ở shallow (0.55)
-- Sét: giữ nước bề mặt → nhiều ở shallow (0.80)
UPDATE soil_library SET infiltration_shallow_ratio = 0.55 WHERE name = 'Đất cát (Sandy)';
UPDATE soil_library SET infiltration_shallow_ratio = 0.60 WHERE name = 'Đất cát pha (Sandy Loam)';
UPDATE soil_library SET infiltration_shallow_ratio = 0.70 WHERE name = 'Đất thịt (Loam)';
UPDATE soil_library SET infiltration_shallow_ratio = 0.75 WHERE name = 'Đất thịt pha sét (Clay Loam)';
UPDATE soil_library SET infiltration_shallow_ratio = 0.80 WHERE name = 'Đất sét (Clay)';
UPDATE soil_library SET infiltration_shallow_ratio = 0.70 WHERE name = 'Đất phù sa (Alluvial)';

-- ============================================================
-- V5: CropSeason infiltration override
-- Cho phép override tỷ lệ thẩm thấu theo từng season (crop + soil combination)
-- ============================================================

ALTER TABLE crop_season
    ADD COLUMN infiltration_shallow_ratio FLOAT NULL
    COMMENT 'Override tỷ lệ thẩm thấu cho season này (0-1). Null = dùng SoilLibrary.infiltration_shallow_ratio. Cho phép tùy chỉnh theo cặp (cây trồng + loại đất)'
    AFTER initial_root_depth;
