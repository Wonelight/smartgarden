package com.example.smart_garden.dto.role.response;

/**
 * List item response DTO for Role (without permissions).
 */
public record RoleListItemResponse(
        Long id,
        String name,
        String description,
        Boolean isSystem,
        Integer permissionCount) {
}
