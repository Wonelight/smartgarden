package com.example.smart_garden.dto.user.response;

import java.util.Set;

import java.time.LocalDateTime;

/**
 * Item cho danh sách user (admin xem).
 */
public record AdminUserListItemResponse(
                Long id,
                String username,
                String email,
                String fullName,
                Set<String> roles,
                Boolean isActive,
                LocalDateTime createdAt,
                LocalDateTime updatedAt) {
}
