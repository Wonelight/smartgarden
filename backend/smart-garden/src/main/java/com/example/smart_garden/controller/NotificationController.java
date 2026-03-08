package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.notification.response.NotificationResponse;
import com.example.smart_garden.entity.enums.NotificationCategory;
import com.example.smart_garden.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** Lấy danh sách thông báo của user hiện tại. */
    @GetMapping(ApiPaths.SEG_NOTIFICATIONS)
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getMyNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) NotificationCategory category) {
        return ResponseEntity.ok(ApiResponse.ok(
                notificationService.getMyNotifications(page, size, category)));
    }

    /** Số thông báo chưa đọc — dùng cho badge trên nav. */
    @GetMapping(ApiPaths.SEG_NOTIFICATIONS_UNREAD_COUNT)
    public ResponseEntity<ApiResponse<Map<String, Long>>> countUnread() {
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("count", notificationService.countUnread())));
    }

    /** Đánh dấu đã đọc một thông báo. */
    @PatchMapping(ApiPaths.SEG_NOTIFICATION_READ)
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    /** Đánh dấu tất cả là đã đọc. */
    @PostMapping(ApiPaths.SEG_NOTIFICATIONS_READ_ALL)
    public ResponseEntity<ApiResponse<Void>> markAllAsRead() {
        notificationService.markAllAsRead();
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
