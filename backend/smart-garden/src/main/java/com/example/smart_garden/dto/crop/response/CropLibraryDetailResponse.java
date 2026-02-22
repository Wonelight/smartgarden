package com.example.smart_garden.dto.crop.response;

import java.time.LocalDateTime;

/**
 * Chi tiết crop library.
 */
public record CropLibraryDetailResponse(
        Long id,
        String name,
        Float kcIni,
        Float kcMid,
        Float kcEnd,
        Integer stageIniDays,
        Integer stageDevDays,
        Integer stageMidDays,
        Integer stageEndDays,
        Float maxRootDepth,
        Float depletionFraction,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
