package com.example.smart_garden.dto.schedule.response;

import com.example.smart_garden.entity.enums.ScheduleType;

import java.time.LocalTime;

/**
 * Item danh sách lịch tưới.
 */
public record ScheduleListItemResponse(
        Long id,
        Long deviceId,
        String scheduleName,
        ScheduleType scheduleType,
        String daysOfWeek,
        LocalTime timeOfDay,
        Integer duration,
        Boolean isActive
) {
}

