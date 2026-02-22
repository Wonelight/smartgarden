package com.example.smart_garden.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request đặt lại mật khẩu với email và mã 6 số từ email.
 * Mật khẩu mới: tối thiểu 8 ký tự, phải chứa cả chữ và số (giống đăng ký).
 */
public record ResetPasswordRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Mã xác nhận phải là 6 số") String code,
        @NotBlank
        @Size(min = 8, max = 100, message = "Mật khẩu từ 8 đến 100 ký tự")
        @Pattern(regexp = "^(?=.*[a-zA-Z])(?=.*[0-9]).+$", message = "Mật khẩu phải chứa cả chữ và số")
        String newPassword
) {
}
