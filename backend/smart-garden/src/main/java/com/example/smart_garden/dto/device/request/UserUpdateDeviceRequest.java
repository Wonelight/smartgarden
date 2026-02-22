package com.example.smart_garden.dto.device.request;

import jakarta.validation.constraints.Size;

/**
 * Request user tự đặt tên / vị trí cho thiết bị của mình.
 */
public record UserUpdateDeviceRequest(
        @Size(max = 100) String deviceName,
        @Size(max = 255) String location,
        Double latitude,
        Double longitude,
        Double altitude) {
}
