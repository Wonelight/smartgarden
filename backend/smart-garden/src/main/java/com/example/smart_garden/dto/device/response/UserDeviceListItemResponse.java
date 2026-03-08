package com.example.smart_garden.dto.device.response;

import com.example.smart_garden.entity.enums.DeviceStatus;

import java.time.LocalDateTime;

/**
 * Item danh sách device cho user (chỉ thiết bị của mình).
 */
public record UserDeviceListItemResponse(
        Long id,
        String deviceName,
        String deviceCode,
        String location,
        Double latitude,
        Double longitude,
        Double altitude,
        DeviceStatus status,
        LocalDateTime lastOnline,
        Double gardenArea,
        Long defaultCropId,
        Long defaultSoilId) {
}
