package com.example.smart_garden.service;

import com.example.smart_garden.dto.auth.LoginRequest;
import com.example.smart_garden.dto.auth.LoginResponse;

/**
 * Service interface cho Authentication (Xác thực).
 */
public interface AuthenticationService {

    /**
     * Đăng nhập và trả về JWT token.
     */
    LoginResponse login(LoginRequest request);

    /**
     * Làm mới access token.
     */
    LoginResponse refreshToken(String refreshToken);

    /**
     * Đăng xuất (invalidate token nếu cần).
     */
    void logout();
}
