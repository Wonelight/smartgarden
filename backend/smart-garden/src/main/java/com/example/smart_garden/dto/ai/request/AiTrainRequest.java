package com.example.smart_garden.dto.ai.request;

import jakarta.validation.constraints.NotNull;

/**
 * Request body để trigger AI model training.
 */
public record AiTrainRequest(
        @NotNull Long deviceId,
        Integer epochs,
        Float learningRate) {
}
