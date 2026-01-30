package com.example.smart_garden.dto.user.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Request user tự cập nhật thông tin cá nhân.
 */
public record SelfUpdateProfileRequest(
        @Email @Size(max = 100) String email,
        @Size(max = 100) String fullName
) {
}

