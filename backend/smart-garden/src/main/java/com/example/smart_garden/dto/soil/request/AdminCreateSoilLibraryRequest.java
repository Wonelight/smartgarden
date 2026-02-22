package com.example.smart_garden.dto.soil.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request tạo soil library mới (admin).
 */
public record AdminCreateSoilLibraryRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @DecimalMin("0") @DecimalMax("100") Float fieldCapacity,
        @NotNull @DecimalMin("0") @DecimalMax("100") Float wiltingPoint,
        @DecimalMin("0.2") @DecimalMax("0.9") Float infiltrationShallowRatio) {  // optional, null = default 0.70
}
