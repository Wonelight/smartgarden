package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Chi tiết log (bao gồm stackTrace và metadata).
 */
public record SystemLogDetailResponse(
        Long id,
        Long deviceId,
        LogLevel logLevel,
        LogSource logSource,
        String message,
        String stackTrace,
        Map<String, Object> metadata,
        LocalDateTime createdAt
) {
}

