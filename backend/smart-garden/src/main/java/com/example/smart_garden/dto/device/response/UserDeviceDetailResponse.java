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
                Double latitude,
                Double longitude,
                Double altitude,
                DeviceStatus status,
                String firmwareVersion,
                LocalDateTime lastOnline,
                Double gardenArea,
                Long defaultCropId,
                Long defaultSoilId) {
}
