package com.example.smart_garden.dto.device.request;

import com.example.smart_garden.entity.enums.DeviceStatus;
import jakarta.validation.constraints.Size;

/**
 * Request cập nhật device (admin).
 */
public record AdminUpdateDeviceRequest(
        @Size(max = 100) String deviceName,
        Long userId,
        @Size(max = 255) String location,
        DeviceStatus status,
        String firmwareVersion
) {
}

