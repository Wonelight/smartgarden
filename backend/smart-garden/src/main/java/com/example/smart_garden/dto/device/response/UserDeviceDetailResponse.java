package com.example.smart_garden.dto.device.response;

import com.example.smart_garden.entity.enums.DeviceStatus;

import java.time.LocalDateTime;

/**
 * Chi tiết device cho user.
 */
public record UserDeviceDetailResponse(
        Long id,
        String deviceName,
        String deviceCode,
        String location,
        DeviceStatus status,
        String firmwareVersion,
        LocalDateTime lastOnline
) {
}

