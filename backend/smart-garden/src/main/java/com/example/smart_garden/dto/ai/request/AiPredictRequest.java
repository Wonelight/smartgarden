package com.example.smart_garden.dto.ai.request;

import jakarta.validation.constraints.NotNull;

/**
 * Request body để trigger AI prediction.
 * - deviceId: bắt buộc — thiết bị cần dự đoán.
 * - sensorDataId: tùy chọn — nếu null, hệ thống tự động
 * tổng hợp (AVG) sensor data 30 phút gần nhất để lọc nhiễu.
 * Nếu truyền vào, sử dụng bản ghi cụ thể đó (backward-compat).
 */
public record AiPredictRequest(
        @NotNull Long deviceId,
        Long sensorDataId) {
}
