package com.example.smart_garden.service;

/**
 * Dịch vụ gửi email.
 */
public interface EmailService {

    /**
     * Gửi email chứa mã xác nhận 6 số để đặt lại mật khẩu.
     *
     * @param toEmail email người nhận
     * @param code mã 6 số (100000-999999)
     */
    void sendPasswordResetCode(String toEmail, String code);
}
