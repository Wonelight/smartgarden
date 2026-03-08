package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.IrrigationDecision;

import java.time.LocalDateTime;

/**
 * Item danh sách kết quả fuzzy.
 */
public record FuzzyLogicResultListItemResponse(
        Long id,
        Long deviceId,
        Long sensorDataId,
        Float fuzzyOutput,
        IrrigationDecision irrigationDecision,
        Integer irrigationDuration,
        Float confidenceScore,
        Integer aiRefinedDuration,
        Float aiConfidence,
        LocalDateTime timestamp) {
}
