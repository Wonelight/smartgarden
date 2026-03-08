package com.example.smart_garden.dto.logs.response;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;

import java.time.LocalDateTime;

/**
 * Response DTO cho System Log.
 */
public record SystemLogResponse(
        Long id,
        LogLevel logLevel,
        LogSource logSource,
        Long deviceId,
        String deviceName,
        String message,
        String stackTrace,
        LocalDateTime createdAt
) {
}
