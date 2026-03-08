package com.example.smart_garden.dto.crop.response;

public record CropRecommendationResponse(
        Long cropId,
        String cropName,
        String reason,
        Float matchScore) {
}
