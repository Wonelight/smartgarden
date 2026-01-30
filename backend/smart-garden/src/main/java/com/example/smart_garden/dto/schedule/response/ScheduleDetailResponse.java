package com.example.smart_garden.dto.schedule.response;

import com.example.smart_garden.entity.enums.ScheduleType;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Chi tiết lịch tưới.
 */
public record ScheduleDetailResponse(
        Long id,
        Long deviceId,
        String scheduleName,
        ScheduleType scheduleType,
        String daysOfWeek,
        LocalTime timeOfDay,
        Integer duration,
        Boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}

