package com.example.smart_garden.dto.irrigation.response;

import com.example.smart_garden.entity.enums.IrrigationHistoryStatus;
import com.example.smart_garden.entity.enums.IrrigationMode;

import java.time.LocalDateTime;

/**
 * Chi tiết lịch sử tưới đầy đủ (admin).
 */
public record AdminIrrigationHistoryDetailResponse(
        Long id,
        Long deviceId,
        Long fuzzyResultId,
        Long mlPredictionId,
        IrrigationMode irrigationMode,
        Integer duration,
        Float waterVolume,
        LocalDateTime startTime,
        LocalDateTime endTime,
        IrrigationHistoryStatus status,
        Float soilMoistureBefore,
        Float soilMoistureAfter,
        String notes
) {
}

