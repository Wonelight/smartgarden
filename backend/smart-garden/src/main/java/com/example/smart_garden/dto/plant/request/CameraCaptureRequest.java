package com.example.smart_garden.dto.plant.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

/**
 * Request chụp ảnh từ camera và phân tích.
 */
public record CameraCaptureRequest(
        Long deviceId,

        @DecimalMin("0.0") @DecimalMax("1.0")
        Float confidence) {

    public CameraCaptureRequest {
        if (deviceId == null) deviceId = 0L;
        if (confidence == null) confidence = 0.25f;
    }
}
