package com.example.smart_garden.dto.user.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Request cập nhật user (dùng cho admin).
 * Role được truyền dưới dạng tên role (String) thay vì enum.
 */
public record AdminUpdateUserRequest(
                @Email @Size(max = 100) String email,
                @Size(max = 100) String fullName,
                String role, // Role name (e.g., "ADMIN", "USER")
                Boolean isActive) {
}
