package com.example.smart_garden.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binding cho cấu hình JWT từ application.properties.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        long expiration,
        long refreshExpiration
) {}
