package com.example.smart_garden.dto.crop.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Request cập nhật crop library (admin).
 */
public record AdminUpdateCropLibraryRequest(
        @Size(max = 100) String name,
        @Positive Float kcIni,
        @Positive Float kcMid,
        @Positive Float kcEnd,
        @Positive Integer stageIniDays,
        @Positive Integer stageDevDays,
        @Positive Integer stageMidDays,
        @Positive Integer stageEndDays,
        @Positive Float maxRootDepth,
        @Positive Float depletionFraction) {
}
