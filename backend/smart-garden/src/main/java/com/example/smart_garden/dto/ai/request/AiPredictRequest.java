package com.example.smart_garden.dto.ai.request;

import jakarta.validation.constraints.NotNull;

/**
 * Request body để trigger AI prediction (ANFIS, RF, etc.).
 */
public record AiPredictRequest(
                @NotNull Long deviceId,
                @NotNull Long sensorDataId) {
}
