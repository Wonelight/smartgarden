package com.example.smart_garden.event;

import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.Notification;
import com.example.smart_garden.entity.SystemLog;
import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.NotificationCategory;
import com.example.smart_garden.entity.enums.NotificationType;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.NotificationRepository;
import com.example.smart_garden.repository.SystemLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lắng nghe SystemLogEvent và persist vào DB một cách bất đồng bộ.
 * Đồng thời tạo Notification per-user khi event liên quan đến thiết bị có chủ.
 * @Async → không block request thread.
 * @Transactional → mỗi lần ghi là một transaction độc lập.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SystemLogEventListener {

    private final SystemLogRepository systemLogRepository;
    private final NotificationRepository notificationRepository;
    private final DeviceRepository deviceRepository;

    @Async
    @EventListener
    @Transactional
    public void onSystemLogEvent(SystemLogEvent event) {
        try {
            Device device = null;
            if (event.getDeviceId() != null) {
                device = deviceRepository.findById(event.getDeviceId()).orElse(null);
            }

            // 1. Persist SystemLog
            SystemLog sysLog = SystemLog.builder()
                    .logLevel(event.getLogLevel())
                    .logSource(event.getLogSource())
                    .device(device)
                    .message(event.getMessage())
                    .stackTrace(event.getStackTrace())
                    .build();
            systemLogRepository.save(sysLog);

            // 2. Tạo Notification cho owner của thiết bị (nếu có)
            if (device != null && device.getUser() != null) {
                Notification notif = buildNotification(event, device);
                if (notif != null) {
                    notificationRepository.save(notif);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to persist SystemLog/Notification [{}]: {}", event.getLogLevel(), e.getMessage());
        }
    }

    // ========== helpers ==========

    /**
     * Phân loại event thành Notification dựa trên nội dung message.
     * Trả về null nếu event không cần tạo notification (e.g. heartbeat log).
     */
    private Notification buildNotification(SystemLogEvent event, Device device) {
        String msg = event.getMessage();
        NotificationType type;
        NotificationCategory category;
        String title;

        if (msg.contains("[IRRIGATE]")) {
            category = NotificationCategory.IRRIGATION;
            if (msg.contains("ACK nhận")) {
                type = NotificationType.SUCCESS;
                title = "Tưới hoàn tất";
            } else if (msg.contains("Timeout ACK")) {
                type = NotificationType.WARNING;
                title = "Thiết bị không phản hồi lệnh tưới";
            } else if (msg.contains("Lỗi gửi lệnh")) {
                type = NotificationType.ERROR;
                title = "Lỗi gửi lệnh tưới";
            } else if (msg.contains("Gửi lệnh tưới")) {
                type = NotificationType.INFO;
                title = "Đã gửi lệnh tưới";
            } else {
                return null;
            }
        } else if (msg.contains("đã kết nối (ONLINE)")) {
            category = NotificationCategory.DEVICE;
            type = NotificationType.SUCCESS;
            title = "Thiết bị kết nối";
        } else if (msg.contains("mất kết nối (OFFLINE)")) {
            category = NotificationCategory.DEVICE;
            type = NotificationType.WARNING;
            title = "Thiết bị mất kết nối";
        } else if (msg.contains("đã được liên kết") || msg.contains("đã được đăng ký")) {
            category = NotificationCategory.DEVICE;
            type = NotificationType.INFO;
            title = msg.contains("đã được đăng ký") ? "Thiết bị mới đã đăng ký" : "Thiết bị được liên kết";
        } else if (msg.contains("đã bị ngắt kết nối bởi")) {
            category = NotificationCategory.DEVICE;
            type = NotificationType.WARNING;
            title = "Thiết bị bị ngắt kết nối";
        } else if (event.getLogLevel() == LogLevel.ERROR) {
            category = NotificationCategory.SYSTEM;
            type = NotificationType.ERROR;
            title = "Lỗi hệ thống";
        } else {
            // Bỏ qua các log không cần hiển thị thông báo
            return null;
        }

        return Notification.builder()
                .userId(device.getUser().getId())
                .deviceId(device.getId())
                .deviceName(device.getDeviceName())
                .type(type)
                .category(category)
                .title(title)
                .message(msg)
                .build();
    }
}

