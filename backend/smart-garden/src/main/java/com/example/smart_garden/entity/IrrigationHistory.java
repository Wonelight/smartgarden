package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.IrrigationHistoryStatus;
import com.example.smart_garden.entity.enums.IrrigationMode;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "irrigation_history",
        indexes = {
                @Index(name = "idx_irrigation_history_device_start_time", columnList = "device_id, start_time")
        }
)
@Where(clause = "deleted_at IS NULL")
public class IrrigationHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fuzzy_result_id")
    private FuzzyLogicResult fuzzyResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ml_prediction_id")
    private MlPrediction mlPrediction;

    @Enumerated(EnumType.STRING)
    @Column(name = "irrigation_mode", nullable = false, length = 20)
    private IrrigationMode irrigationMode;

    @Column(name = "duration", nullable = false)
    private Integer duration;

    @Column(name = "water_volume")
    private Float waterVolume;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private IrrigationHistoryStatus status = IrrigationHistoryStatus.COMPLETED;

    @Column(name = "soil_moisture_before")
    private Float soilMoistureBefore;

    @Column(name = "soil_moisture_after")
    private Float soilMoistureAfter;

    @Lob
    @Column(name = "notes")
    private String notes;
}

