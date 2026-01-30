package com.example.smart_garden.dto.irrigation.response;

import java.time.LocalDateTime;

/**
 * Response chi tiết cấu hình tưới.
 */
public record IrrigationConfigDetailResponse(
        Long id,
        Long deviceId,
        Float soilMoistureMin,
        Float soilMoistureMax,
        Float soilMoistureOptimal,
        Float tempMin,
        Float tempMax,
        Float lightThreshold,
        Integer irrigationDurationMin,
        Integer irrigationDurationMax,
        Boolean fuzzyEnabled,
        Boolean autoMode,
        LocalDateTime updatedAt
) {
}

