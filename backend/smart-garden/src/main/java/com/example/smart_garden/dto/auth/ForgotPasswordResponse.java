package com.example.smart_garden.dto.auth;

/**
 * Response sau khi gửi yêu cầu quên mật khẩu.
 * Mã 6 số được gửi qua email, không trả về trong response.
 */
public record ForgotPasswordResponse(
        String message
) {
    public static ForgotPasswordResponse success() {
        return new ForgotPasswordResponse(
                "Nếu tài khoản với email này tồn tại, bạn sẽ nhận được mã xác nhận 6 số qua email."
        );
    }
}
