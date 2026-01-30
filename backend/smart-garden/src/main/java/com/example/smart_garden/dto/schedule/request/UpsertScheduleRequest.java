package com.example.smart_garden.dto.schedule.request;

import com.example.smart_garden.entity.enums.ScheduleType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

/**
 * Request tạo/cập nhật lịch tưới (user hoặc admin cho device cụ thể).
 */
public record UpsertScheduleRequest(
        @NotNull Long deviceId,
        @NotBlank String scheduleName,
        @NotNull ScheduleType scheduleType,
        /**
         * Các ngày trong tuần: "1,2,3...7" (chỉ dùng cho WEEKLY/CUSTOM).
         */
        String daysOfWeek,
        @NotNull LocalTime timeOfDay,
        @NotNull Integer duration,
        Boolean isActive
) {
}

