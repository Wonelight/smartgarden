package com.example.smart_garden.dto.plant.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Trạng thái camera trên AI service.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CameraStatusResponse(
        @JsonProperty("camera_available") boolean cameraAvailable,
        int source,
        @JsonProperty("model_loaded") boolean modelLoaded,
        Object resolution,
        Double fps) {
}
