package com.example.smart_garden.dto.soil.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

/**
 * Request cập nhật soil library (admin).
 */
public record AdminUpdateSoilLibraryRequest(
        @Size(max = 100) String name,
        @DecimalMin("0") @DecimalMax("100") Float fieldCapacity,
        @DecimalMin("0") @DecimalMax("100") Float wiltingPoint,
        @DecimalMin("0.2") @DecimalMax("0.9") Float infiltrationShallowRatio) {
}
