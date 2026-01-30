package com.example.smart_garden.dto.monitoring.response;

import java.time.LocalDateTime;

/**
 * Chi tiết dữ liệu cảm biến (detail view).
 */
public record SensorDataDetailResponse(
        Long id,
        Long deviceId,
        Float soilMoisture,
        Float temperature,
        Float humidity,
        Float lightIntensity,
        Boolean rainDetected,
        Float ambientLight,
        LocalDateTime timestamp
) {
}

