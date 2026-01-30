package com.example.smart_garden.dto.control.request;

import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlInitiatedBy;
import com.example.smart_garden.entity.enums.ControlType;
import jakarta.validation.constraints.NotNull;

/**
 * Admin / hệ thống nội bộ tạo lệnh điều khiển.
 */
public record AdminDeviceControlRequest(
        @NotNull Long deviceId,
        @NotNull ControlType controlType,
        @NotNull ControlAction action,
        Integer duration,
        ControlInitiatedBy initiatedBy,
        Long userId
) {
}

