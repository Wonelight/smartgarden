package com.example.smart_garden.dto.irrigation.response;

import com.example.smart_garden.entity.enums.IrrigationHistoryStatus;
import com.example.smart_garden.entity.enums.IrrigationMode;

import java.time.LocalDateTime;

/**
 * Chi tiết lịch sử tưới cho user (ẩn bớt thông tin nội bộ).
 */
public record UserIrrigationHistoryDetailResponse(
        Long id,
        IrrigationMode irrigationMode,
        Integer duration,
        Float waterVolume,
        LocalDateTime startTime,
        LocalDateTime endTime,
        IrrigationHistoryStatus status,
        Float soilMoistureBefore,
        Float soilMoistureAfter
) {
}

