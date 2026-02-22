package com.example.smart_garden.dto.role.request;

import jakarta.validation.constraints.NotNull;

import java.util.Set;

/**
 * Request DTO for assigning permissions to a role.
 */
public record AssignPermissionsRequest(
        @NotNull(message = "Permission IDs are required") Set<Long> permissionIds) {
}
