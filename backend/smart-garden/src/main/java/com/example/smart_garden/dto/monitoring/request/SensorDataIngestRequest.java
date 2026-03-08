package com.example.smart_garden.dto.monitoring.request;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

/**
 * Payload ESP32 gửi dữ liệu cảm biến lên backend.
 */
public record SensorDataIngestRequest(
                @NotNull Long deviceId,
                Float soilMoisture,
                Float temperature,
                Float humidity,
                Float lightIntensity,
                Boolean rainDetected,
                Float rainIntensity,
                Float ambientLight,
                LocalDateTime timestamp) {
}
