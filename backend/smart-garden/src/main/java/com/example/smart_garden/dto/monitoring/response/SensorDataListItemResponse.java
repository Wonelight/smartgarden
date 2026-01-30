package com.example.smart_garden.dto.monitoring.response;

import java.time.LocalDateTime;

/**
 * Item cho danh sách dữ liệu cảm biến (list view).
 */
public record SensorDataListItemResponse(
        Long id,
        Float soilMoisture,
        Float temperature,
        Float humidity,
        Float lightIntensity,
        Boolean rainDetected,
        Float ambientLight,
        LocalDateTime timestamp
) {
}

