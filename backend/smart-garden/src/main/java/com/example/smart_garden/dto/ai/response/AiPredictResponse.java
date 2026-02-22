package com.example.smart_garden.dto.ai.response;

import java.time.LocalDateTime;

/**
 * Response từ AI prediction.
 */
public record AiPredictResponse(
        Long predictionId,
        Long deviceId,
        Integer predictedDuration,
        Float aiOutput,
        Float confidence,
        Integer refinedDuration,
        LocalDateTime createdAt) {
}
