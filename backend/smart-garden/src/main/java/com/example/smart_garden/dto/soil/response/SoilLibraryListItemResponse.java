package com.example.smart_garden.dto.soil.response;

import java.time.LocalDateTime;

/**
 * Item danh sách soil library.
 */
public record SoilLibraryListItemResponse(
        Long id,
        String name,
        Float fieldCapacity,
        Float wiltingPoint,
        Float infiltrationShallowRatio,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
