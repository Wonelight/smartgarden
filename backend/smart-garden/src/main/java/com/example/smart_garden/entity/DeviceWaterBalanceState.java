package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.Where;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "device_water_balance_state", uniqueConstraints = {
        @UniqueConstraint(name = "uk_device_wb_state_device", columnNames = "device_id")
}, indexes = {
        @Index(name = "idx_device_wb_state_device", columnList = "device_id")
})
@Where(clause = "deleted_at IS NULL")
public class DeviceWaterBalanceState extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false, unique = true)
    private Device device;

    // Shallow layer state
    @Builder.Default
    @Column(name = "shallow_depletion", nullable = false)
    private Float shallowDepletion = 0.0f;

    @Builder.Default
    @Column(name = "shallow_taw", nullable = false)
    private Float shallowTaw = 0.0f;

    @Builder.Default
    @Column(name = "shallow_raw", nullable = false)
    private Float shallowRaw = 0.0f;

    // Deep layer state
    @Builder.Default
    @Column(name = "deep_depletion", nullable = false)
    private Float deepDepletion = 0.0f;

    @Builder.Default
    @Column(name = "deep_taw", nullable = false)
    private Float deepTaw = 0.0f;

    @Builder.Default
    @Column(name = "deep_raw", nullable = false)
    private Float deepRaw = 0.0f;

    // Irrigation tracking
    @Builder.Default
    @Column(name = "last_irrigation", nullable = false)
    private Float lastIrrigation = 0.0f;

    // Soil moisture history (JSON array)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "soil_moist_history", columnDefinition = "json")
    private List<Map<String, Object>> soilMoisHistory;

    /** Lịch sử weighted depletion theo thời gian (để tính lag 6h/12h/24h). Mỗi entry: {"timestamp": ISO, "value": number}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "depletion_history", columnDefinition = "json")
    private List<Map<String, Object>> depletionHistory;

    /** Lịch sử ETc theo giờ (để tính etc_rolling 6h/12h/24h). Mỗi entry: {"timestamp": ISO, "value": float (mm)}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "etc_history", columnDefinition = "json")
    private List<Map<String, Object>> etcHistory;

    // Computed properties
    public Float getWeightedDepletion() {
        return 0.6f * deepDepletion + 0.4f * shallowDepletion;
    }

    public Float getTotalTaw() {
        return shallowTaw + deepTaw;
    }

    public Float getTotalRaw() {
        return shallowRaw + deepRaw;
    }
}
