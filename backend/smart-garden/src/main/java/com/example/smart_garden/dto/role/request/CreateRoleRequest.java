package com.example.smart_garden.dto.role.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;

/**
 * Request DTO for creating a new role.
 */
public record CreateRoleRequest(
        @NotBlank(message = "Role name is required") @Size(max = 50, message = "Role name must not exceed 50 characters") String name,

        @Size(max = 255, message = "Description must not exceed 255 characters") String description,

        @NotNull(message = "Permission IDs are required") Set<Long> permissionIds) {
}
