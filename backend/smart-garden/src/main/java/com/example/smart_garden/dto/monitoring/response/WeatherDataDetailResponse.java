package com.example.smart_garden.dto.monitoring.response;

import java.time.LocalDateTime;

/**
 * Item danh sách / chi tiết dữ liệu thời tiết.
 */
public record WeatherDataDetailResponse(
        Long id,
        String location,
        Float temperature,
        Float humidity,
        Float precipitation,
        Float precipitationProbability,
        Float windSpeed,
        Float uvIndex,
        LocalDateTime forecastTime,
        LocalDateTime createdAt
) {
}

