package com.example.smart_garden.dto.auth;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInMs
) {
    public static final String TOKEN_TYPE = "Bearer";

    public static LoginResponse of(String accessToken, String refreshToken, long expiresInMs) {
        return new LoginResponse(accessToken, refreshToken, TOKEN_TYPE, expiresInMs);
    }
}
