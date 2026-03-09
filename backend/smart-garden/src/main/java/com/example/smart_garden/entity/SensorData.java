package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Where;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "sensor_data", indexes = {
                @Index(name = "idx_sensor_data_device_timestamp", columnList = "device_id, timestamp")
})
@Where(clause = "deleted_at IS NULL")
public class SensorData extends BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "device_id", nullable = false)
        private Device device;

        /**
         * Full MQTT sensor payload stored as JSON.
         * Chứa toàn bộ dữ liệu sensor trong 1 cột JSON linh hoạt,
         * thay vì nhiều cột riêng lẻ — dễ mở rộng sensor mới.
         *
         * Keys expected: soilMoisture, soilMoisture2, temperature, humidity,
         * lightIntensity, rainDetected, rainIntensity, ambientLight,
         * pumpState, lightState
         */
        @JdbcTypeCode(SqlTypes.JSON)
        @Column(name = "payload", columnDefinition = "json", nullable = false)
        private Map<String, Object> payload;

        // Thời điểm sensor đo thực tế (từ ESP32 ts field).
        // KHÔNG dùng @CreationTimestamp — để ingestFromMqtt set từ payload.ts.
        // Nếu ESP32 không gửi ts → ingestFromMqtt fallback về LocalDateTime.now().
        @Column(name = "timestamp", updatable = false)
        private LocalDateTime timestamp;

        // ================================================================
        // Convenience getters — extract typed values from JSON payload.
        // Đảm bảo backward-compatibility với code cũ (mapper, AI service).
        // ================================================================

        @Transient
        public Float getSoilMoisture() {
                return extractFloat("soilMoisture");
        }

        @Transient
        public Float getSoilMoisture2() {
                return extractFloat("soilMoisture2");
        }

        @Transient
        public Float getTemperature() {
                return extractFloat("temperature");
        }

        @Transient
        public Float getHumidity() {
                return extractFloat("humidity");
        }

        @Transient
        public Float getLightIntensity() {
                return extractFloat("lightIntensity");
        }

        @Transient
        public Boolean getRainDetected() {
                if (payload == null)
                        return null;
                Object v = payload.get("rainDetected");
                if (v instanceof Boolean)
                        return (Boolean) v;
                if (v instanceof Number)
                        return ((Number) v).intValue() != 0;
                return null;
        }

        @Transient
        public Float getRainIntensity() {
                return extractFloat("rainIntensity");
        }

        @Transient
        public Float getAmbientLight() {
                return extractFloat("ambientLight");
        }

        // ================================================================
        // Helper
        // ================================================================

        private Float extractFloat(String key) {
                if (payload == null)
                        return null;
                Object v = payload.get(key);
                if (v instanceof Number)
                        return ((Number) v).floatValue();
                return null;
        }
}
