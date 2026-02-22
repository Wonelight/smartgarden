package com.example.smart_garden.dto.user.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request tạo user (dùng cho admin).
 * Role được truyền dưới dạng tên role (String) thay vì enum.
 */
public record AdminCreateUserRequest(
                @NotBlank @Size(max = 50) String username,
                @NotBlank @Size(min = 6, max = 100) String password,
                @Email @Size(max = 100) String email,
                @Size(max = 100) String fullName,
                String role, // Role name (e.g., "ADMIN", "USER")
                Boolean isActive) {
}
