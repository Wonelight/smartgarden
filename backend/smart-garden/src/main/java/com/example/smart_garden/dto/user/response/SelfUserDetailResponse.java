package com.example.smart_garden.dto.user.response;

import com.example.smart_garden.entity.enums.UserRole;

/**
 * Thông tin tài khoản cho chính user đang đăng nhập.
 */
public record SelfUserDetailResponse(
        Long id,
        String username,
        String email,
        String fullName,
        UserRole role
) {
}

