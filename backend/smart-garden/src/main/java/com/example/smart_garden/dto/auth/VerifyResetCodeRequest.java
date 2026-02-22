package com.example.smart_garden.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Request xác nhận mã đặt lại mật khẩu (bước 1, trước khi nhập mật khẩu mới).
 */
public record VerifyResetCodeRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Mã xác nhận phải là 6 số") String code
) {}
