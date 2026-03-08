package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.time.LocalDateTime;

/**
 * Dữ liệu sensor tổng hợp theo giờ (hourly aggregation).
 *
 * Mỗi bản ghi chứa AVG/MIN/MAX cho mỗi metric trong 1 giờ
 * cho 1 device. Phục vụ dashboard charts cho range > 24h,
 * giảm ~360x lượng data so với raw sensor_data.
 *
 * Tự động tạo bởi batch job chạy mỗi giờ.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "sensor_data_hourly", uniqueConstraints = {
        @UniqueConstraint(name = "uk_sensor_hourly_device_hour", columnNames = { "device_id", "hour_start" })
}, indexes = {
        @Index(name = "idx_sensor_hourly_device_hour", columnList = "device_id, hour_start")
})
@Where(clause = "deleted_at IS NULL")
public class SensorDataHourly extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    /** Thời điểm bắt đầu giờ (e.g., 2026-03-04T14:00:00) */
    @Column(name = "hour_start", nullable = false)
    private LocalDateTime hourStart;

    // ── Soil Moisture 1 ──
    @Column(name = "avg_soil_moisture")
    private Float avgSoilMoisture;
    @Column(name = "min_soil_moisture")
    private Float minSoilMoisture;
    @Column(name = "max_soil_moisture")
    private Float maxSoilMoisture;

    // ── Soil Moisture 2 ──
    @Column(name = "avg_soil_moisture_2")
    private Float avgSoilMoisture2;
    @Column(name = "min_soil_moisture_2")
    private Float minSoilMoisture2;
    @Column(name = "max_soil_moisture_2")
    private Float maxSoilMoisture2;

    // ── Temperature ──
    @Column(name = "avg_temperature")
    private Float avgTemperature;
    @Column(name = "min_temperature")
    private Float minTemperature;
    @Column(name = "max_temperature")
    private Float maxTemperature;

    // ── Humidity ──
    @Column(name = "avg_humidity")
    private Float avgHumidity;
    @Column(name = "min_humidity")
    private Float minHumidity;
    @Column(name = "max_humidity")
    private Float maxHumidity;

    // ── Light Intensity ──
    @Column(name = "avg_light_intensity")
    private Float avgLightIntensity;
    @Column(name = "min_light_intensity")
    private Float minLightIntensity;
    @Column(name = "max_light_intensity")
    private Float maxLightIntensity;

    // ── Rain ──
    @Column(name = "avg_rain_intensity")
    private Float avgRainIntensity;
    /** Số lần phát hiện mưa trong giờ */
    @Column(name = "rain_detected_count")
    private Integer rainDetectedCount;

    /** Số bản ghi raw đã aggregate trong giờ này */
    @Column(name = "sample_count", nullable = false)
    private Integer sampleCount;
}
