package com.example.smart_garden.dto.permission.response;

/**
 * Response DTO for Permission details.
 */
public record PermissionResponse(
        Long id,
        String name,
        String description,
        String category) {
}
