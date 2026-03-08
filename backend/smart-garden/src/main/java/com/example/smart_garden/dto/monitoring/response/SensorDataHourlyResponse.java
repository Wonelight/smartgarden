package com.example.smart_garden.dto.monitoring.response;

import java.time.LocalDateTime;

/**
 * Response DTO cho dữ liệu sensor tổng hợp theo giờ.
 * Chứa AVG/MIN/MAX cho mỗi metric trong 1 giờ.
 */
public record SensorDataHourlyResponse(
        Long id,
        Long deviceId,
        LocalDateTime hourStart,
        // Soil 1
        Float avgSoilMoisture,
        Float minSoilMoisture,
        Float maxSoilMoisture,
        // Soil 2
        Float avgSoilMoisture2,
        Float minSoilMoisture2,
        Float maxSoilMoisture2,
        // Temperature
        Float avgTemperature,
        Float minTemperature,
        Float maxTemperature,
        // Humidity
        Float avgHumidity,
        Float minHumidity,
        Float maxHumidity,
        // Light
        Float avgLightIntensity,
        Float minLightIntensity,
        Float maxLightIntensity,
        // Rain
        Float avgRainIntensity,
        Integer rainDetectedCount,
        // Meta
        Integer sampleCount) {
}
