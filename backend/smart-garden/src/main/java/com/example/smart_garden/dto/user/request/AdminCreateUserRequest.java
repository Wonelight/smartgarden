package com.example.smart_garden.dto.user.request;

import com.example.smart_garden.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request tạo user (dùng cho admin).
 */
public record AdminCreateUserRequest(
        @NotBlank @Size(max = 50) String username,
        @NotBlank @Size(min = 6, max = 100) String password,
        @Email @Size(max = 100) String email,
        @Size(max = 100) String fullName,
        UserRole role,
        Boolean isActive
) {
}

