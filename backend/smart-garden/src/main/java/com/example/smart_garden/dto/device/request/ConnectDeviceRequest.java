package com.example.smart_garden.dto.device.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request kết nối vườn với thiết bị ESP32 bằng địa chỉ MAC.
 * ESP32 kết nối WiFi → hiển thị MAC (vd AA:BB:CC:DD:EE:FF), user nhập vào đây.
 */
public record ConnectDeviceRequest(
        @NotBlank(message = "Địa chỉ MAC không được để trống")
        @Size(max = 20)
        String macAddress
) {
}
