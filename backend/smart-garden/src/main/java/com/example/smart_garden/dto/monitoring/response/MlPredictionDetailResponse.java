package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.PredictionType;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Chi tiết dự báo ML (bao gồm features đã dùng).
 */
public record MlPredictionDetailResponse(
        Long id,
        Long deviceId,
        PredictionType predictionType,
        Float predictedWaterAmount,
        Integer predictedDuration,
        Integer predictionHorizon,
        Float modelAccuracy,
        Map<String, Object> featuresUsed,
        Float aiOutput,
        Map<String, Object> aiParams,
        Float aiAccuracy,
        LocalDateTime createdAt) {
}
