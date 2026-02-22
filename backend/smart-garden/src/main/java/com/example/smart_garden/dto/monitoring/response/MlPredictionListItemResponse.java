package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.PredictionType;

import java.time.LocalDateTime;

/**
 * Item danh sách dự báo ML.
 */
public record MlPredictionListItemResponse(
                Long id,
                Long deviceId,
                PredictionType predictionType,
                Float predictedWaterAmount,
                Integer predictedDuration,
                Integer predictionHorizon,
                Float modelAccuracy,
                Float anfisOutput,
                Float anfisAccuracy,
                LocalDateTime createdAt) {
}
