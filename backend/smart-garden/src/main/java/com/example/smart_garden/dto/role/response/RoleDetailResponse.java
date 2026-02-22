package com.example.smart_garden.dto.role.response;

import com.example.smart_garden.dto.permission.response.PermissionResponse;

import java.util.Set;

/**
 * Detailed response DTO for Role with permissions.
 */
public record RoleDetailResponse(
        Long id,
        String name,
        String description,
        Boolean isSystem,
        Set<PermissionResponse> permissions,
        Integer userCount) {
}
