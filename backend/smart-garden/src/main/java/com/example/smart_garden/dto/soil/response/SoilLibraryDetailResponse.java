package com.example.smart_garden.dto.soil.response;

import java.time.LocalDateTime;

/**
 * Chi tiết soil library.
 */
public record SoilLibraryDetailResponse(
        Long id,
        String name,
        Float fieldCapacity,
        Float wiltingPoint,
        Float infiltrationShallowRatio,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
