package com.example.smart_garden.dto.user.response;

import java.util.Set;

import java.time.LocalDateTime;

/**
 * Chi tiết user cho admin.
 */
public record AdminUserDetailResponse(
                Long id,
                String username,
                String email,
                String fullName,
                Set<String> roles,
                Boolean isActive,
                LocalDateTime createdAt,
                LocalDateTime updatedAt,
                LocalDateTime deletedAt) {
}
