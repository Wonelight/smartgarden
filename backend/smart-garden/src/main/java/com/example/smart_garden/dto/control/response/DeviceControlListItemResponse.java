package com.example.smart_garden.dto.control.response;

import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlInitiatedBy;
import com.example.smart_garden.entity.enums.ControlStatus;
import com.example.smart_garden.entity.enums.ControlType;

import java.time.LocalDateTime;

/**
 * Item danh sách lệnh điều khiển.
 */
public record DeviceControlListItemResponse(
        Long id,
        Long deviceId,
        ControlType controlType,
        ControlAction action,
        Integer duration,
        ControlInitiatedBy initiatedBy,
        Long userId,
        ControlStatus status,
        LocalDateTime createdAt,
        LocalDateTime executedAt
) {
}

