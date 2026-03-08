package com.example.smart_garden.dto.crop.request;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CropSeasonCreateRequest(
        @NotNull(message = "Crop ID is required") Long cropId,
        @NotNull(message = "Soil ID is required") Long soilId,
        @NotNull(message = "Start date is required") LocalDate startDate,
        Float initialRootDepth,
        Float infiltrationShallowRatio) {
}
