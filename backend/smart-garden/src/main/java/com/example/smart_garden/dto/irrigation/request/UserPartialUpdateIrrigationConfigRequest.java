package com.example.smart_garden.dto.irrigation.request;

/**
 * User chỉnh một phần cấu hình tưới (nếu được phép).
 */
public record UserPartialUpdateIrrigationConfigRequest(
                Float soilMoistureOptimal,
                Integer irrigationDurationMin,
                Integer irrigationDurationMax,
                Boolean autoMode,
                Boolean fuzzyEnabled,
                Boolean aiEnabled,
                Float pumpFlowRate,
                Integer nozzleCount) {
}
