package com.example.smart_garden.service;

import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.notification.response.NotificationResponse;
import com.example.smart_garden.entity.enums.NotificationCategory;

public interface NotificationService {

    /** Lấy thông báo của user hiện tại (phân trang, lọc theo category). */
    PageResponse<NotificationResponse> getMyNotifications(int page, int size, NotificationCategory category);

    /** Số thông báo chưa đọc của user hiện tại. */
    long countUnread();

    /** Đánh dấu đã đọc một thông báo (chỉ owner mới được). */
    void markAsRead(Long notificationId);

    /** Đánh dấu tất cả là đã đọc. */
    void markAllAsRead();
}
