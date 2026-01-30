package com.example.smart_garden.dto.monitoring.response;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;

import java.time.LocalDateTime;

/**
 * Item danh sách log (dùng cho UI log viewer).
 */
public record SystemLogListItemResponse(
        Long id,
        Long deviceId,
        LogLevel logLevel,
        LogSource logSource,
        String message,
        LocalDateTime createdAt
) {
}

