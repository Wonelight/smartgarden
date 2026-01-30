package com.example.smart_garden.dto.device.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request tạo device (admin gán cho user).
 */
public record AdminCreateDeviceRequest(
        @NotBlank @Size(max = 50) String deviceCode,
        @NotBlank @Size(max = 100) String deviceName,
        Long userId,
        @Size(max = 255) String location
) {
}

