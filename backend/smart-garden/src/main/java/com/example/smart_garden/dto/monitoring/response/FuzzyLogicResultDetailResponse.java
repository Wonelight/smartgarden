package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.IrrigationDecision;

import java.time.LocalDateTime;

/**
 * Chi tiết kết quả fuzzy.
 */
public record FuzzyLogicResultDetailResponse(
                Long id,
                Long deviceId,
                Long sensorDataId,
                Float fuzzyOutput,
                IrrigationDecision irrigationDecision,
                Integer irrigationDuration,
                Float confidenceScore,
                Integer anfisRefinedDuration,
                Float anfisConfidence,
                Long mlPredictionId,
                LocalDateTime timestamp) {
}
