package com.example.smart_garden.dto.role.request;

import jakarta.validation.constraints.Size;

/**
 * Request DTO for updating an existing role.
 */
public record UpdateRoleRequest(
        @Size(max = 50, message = "Role name must not exceed 50 characters") String name,

        @Size(max = 255, message = "Description must not exceed 255 characters") String description) {
}
