package com.example.smart_garden.dto.plant.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Response từ AI service plant analysis.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlantAnalyzeResponse(
        @JsonProperty("device_id") Long deviceId,
        String task,
        List<Detection> detections,
        List<Classification> classifications,
        List<Segment> segments,
        PlantHealthSummary summary,
        @JsonProperty("inference_ms") Double inferenceMs) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Detection(
            String label,
            Double confidence,
            BoundingBox bbox) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Classification(
            String label,
            Double confidence) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Segment(
            String label,
            Double confidence,
            BoundingBox bbox,
            @JsonProperty("area_pixels") Integer areaPixels) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BoundingBox(
            Double x1, Double y1, Double x2, Double y2) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlantHealthSummary(
            String status,
            @JsonProperty("health_score") Double healthScore,
            @JsonProperty("disease_names") List<String> diseaseNames,
            @JsonProperty("pest_names") List<String> pestNames,
            @JsonProperty("affected_area_pct") Double affectedAreaPct,
            String recommendation) {
    }
}
