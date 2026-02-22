package com.example.smart_garden.dto.crop.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Request tạo crop library mới (admin).
 */
public record AdminCreateCropLibraryRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @Positive Float kcIni,
        @NotNull @Positive Float kcMid,
        @NotNull @Positive Float kcEnd,
        @NotNull @Positive Integer stageIniDays,
        @NotNull @Positive Integer stageDevDays,
        @NotNull @Positive Integer stageMidDays,
        @NotNull @Positive Integer stageEndDays,
        @NotNull @Positive Float maxRootDepth,
        @NotNull @Positive Float depletionFraction) {
}
