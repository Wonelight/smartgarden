package com.example.smart_garden.dto.user.response;

import java.util.Set;

/**
 * Thông tin tài khoản cho chính user đang đăng nhập.
 */
public record SelfUserDetailResponse(
                Long id,
                String username,
                String email,
                String fullName,
                Set<String> roles) {
}
