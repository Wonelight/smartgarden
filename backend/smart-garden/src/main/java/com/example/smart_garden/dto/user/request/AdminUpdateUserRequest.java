package com.example.smart_garden.dto.user.request;

import com.example.smart_garden.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Request cập nhật user (dùng cho admin).
 */
public record AdminUpdateUserRequest(
        @Email @Size(max = 100) String email,
        @Size(max = 100) String fullName,
        UserRole role,
        Boolean isActive
) {
}

