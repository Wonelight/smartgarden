package com.example.smart_garden.dto.user.response;

import com.example.smart_garden.entity.enums.UserRole;

import java.time.LocalDateTime;

/**
 * Item cho danh sách user (admin xem).
 */
public record AdminUserListItemResponse(
        Long id,
        String username,
        String email,
        String fullName,
        UserRole role,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

