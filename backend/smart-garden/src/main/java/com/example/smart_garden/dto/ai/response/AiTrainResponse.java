package com.example.smart_garden.dto.ai.response;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Response từ AI model training.
 */
public record AiTrainResponse(
        Long predictionId,
        Long deviceId,
        Float accuracy,
        String status,
        Map<String, Object> params,
        LocalDateTime createdAt) {
}
