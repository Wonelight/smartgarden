package com.example.smart_garden.dto.irrigation.response;

import com.example.smart_garden.entity.enums.IrrigationHistoryStatus;
import com.example.smart_garden.entity.enums.IrrigationMode;

import java.time.LocalDateTime;

/**
 * Item danh sách lịch sử tưới (user & admin).
 */
public record IrrigationHistoryListItemResponse(
        Long id,
        Long deviceId,
        IrrigationMode irrigationMode,
        Integer duration,
        Float waterVolume,
        LocalDateTime startTime,
        LocalDateTime endTime,
        IrrigationHistoryStatus status
) {
}

