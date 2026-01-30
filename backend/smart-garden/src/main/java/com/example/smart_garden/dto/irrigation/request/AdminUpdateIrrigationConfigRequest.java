package com.example.smart_garden.dto.irrigation.request;

import jakarta.validation.constraints.NotNull;

/**
 * Admin chỉnh cấu hình tưới cho thiết bị.
 */
public record AdminUpdateIrrigationConfigRequest(
        @NotNull Long deviceId,
        Float soilMoistureMin,
        Float soilMoistureMax,
        Float soilMoistureOptimal,
        Float tempMin,
        Float tempMax,
        Float lightThreshold,
        Integer irrigationDurationMin,
        Integer irrigationDurationMax,
        Boolean fuzzyEnabled,
        Boolean autoMode
) {
}

