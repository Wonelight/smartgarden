package com.example.smart_garden.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request gửi email để nhận link đặt lại mật khẩu.
 */
public record ForgotPasswordRequest(
        @NotBlank @Email String email
) {
}
