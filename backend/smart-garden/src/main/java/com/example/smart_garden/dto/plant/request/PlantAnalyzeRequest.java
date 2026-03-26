package com.example.smart_garden.dto.plant.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

/**
 * Request gửi ảnh base64 để phân tích bệnh cây.
 */
public record PlantAnalyzeRequest(
        Long deviceId,

        @NotBlank(message = "image_base64 không được trống")
        String imageBase64,

        String task,

        @DecimalMin("0.0") @DecimalMax("1.0")
        Float confidenceThreshold) {

    public PlantAnalyzeRequest {
        if (deviceId == null) deviceId = 0L;
        if (task == null || task.isBlank()) task = "detect";
        if (confidenceThreshold == null) confidenceThreshold = 0.25f;
    }
}
