package com.example.smart_garden.dto.control.request;

import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlType;
import jakarta.validation.constraints.NotNull;

/**
 * User gửi lệnh điều khiển thiết bị.
 */
public record UserDeviceControlRequest(
        @NotNull Long deviceId,
        @NotNull ControlType controlType,
        @NotNull ControlAction action,
        Integer duration
) {
}

