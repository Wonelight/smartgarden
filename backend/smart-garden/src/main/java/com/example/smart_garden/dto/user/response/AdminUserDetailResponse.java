package com.example.smart_garden.dto.user.response;

import com.example.smart_garden.entity.enums.UserRole;

import java.time.LocalDateTime;

/**
 * Chi tiết user cho admin.
 */
public record AdminUserDetailResponse(
        Long id,
        String username,
        String email,
        String fullName,
        UserRole role,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime deletedAt
) {
}

