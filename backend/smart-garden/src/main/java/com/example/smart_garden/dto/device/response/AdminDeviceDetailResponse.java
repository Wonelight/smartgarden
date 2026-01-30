package com.example.smart_garden.dto.device.response;

import com.example.smart_garden.entity.enums.DeviceStatus;

import java.time.LocalDateTime;

/**
 * Chi tiết device cho admin.
 */
public record AdminDeviceDetailResponse(
        Long id,
        String deviceCode,
        String deviceName,
        String location,
        DeviceStatus status,
        String firmwareVersion,
        LocalDateTime lastOnline,
        Long userId,
        String username,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

