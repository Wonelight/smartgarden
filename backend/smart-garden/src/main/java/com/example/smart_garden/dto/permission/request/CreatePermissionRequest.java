package com.example.smart_garden.dto.permission.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for creating a new permission.
 */
public record CreatePermissionRequest(
        @NotBlank(message = "Permission name is required") @Size(max = 100, message = "Permission name must not exceed 100 characters") String name,

        @Size(max = 255, message = "Description must not exceed 255 characters") String description,

        @NotBlank(message = "Category is required") @Size(max = 50, message = "Category must not exceed 50 characters") String category) {
}
