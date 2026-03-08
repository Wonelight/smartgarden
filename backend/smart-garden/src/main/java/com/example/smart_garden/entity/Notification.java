package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.NotificationCategory;
import com.example.smart_garden.entity.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;

/**
 * Thông báo per-user: ghi nhận sự kiện thiết bị/tưới/hệ thống.
 * Được tạo bởi SystemLogEventListener song song với SystemLog.
 * userId + deviceId lưu dạng snapshot (Long) — tránh join phức tạp.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "notification",
        indexes = {
                @Index(name = "idx_notif_user_created", columnList = "user_id, created_at DESC"),
                @Index(name = "idx_notif_user_read", columnList = "user_id, is_read")
        }
)
public class Notification extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Snapshot — nullable nếu thông báo cấp hệ thống không liên quan thiết bị cụ thể. */
    @Column(name = "device_id")
    private Long deviceId;

    @Column(name = "device_name", length = 100)
    private String deviceName;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    private NotificationCategory category;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Lob
    @Column(name = "message", nullable = false)
    private String message;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;
}
