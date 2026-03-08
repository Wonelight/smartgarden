package com.example.smart_garden.dto.notification.response;

import com.example.smart_garden.entity.enums.NotificationCategory;
import com.example.smart_garden.entity.enums.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        NotificationType type,
        NotificationCategory category,
        Long deviceId,
        String deviceName,
        String title,
        String message,
        boolean read,
        LocalDateTime createdAt
) {}
