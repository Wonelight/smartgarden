package com.example.smart_garden.dto.plant.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response từ camera capture — bao gồm kết quả phân tích + ảnh annotated.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CameraCaptureResponse(
        PlantAnalyzeResponse analysis,
        @JsonProperty("annotated_image_base64") String annotatedImageBase64) {
}
