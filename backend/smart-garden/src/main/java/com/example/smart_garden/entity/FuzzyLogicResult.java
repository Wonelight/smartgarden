package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.IrrigationDecision;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Where;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "fuzzy_logic_result", indexes = {
                @Index(name = "idx_fuzzy_result_device_timestamp", columnList = "device_id, timestamp")
})
@Where(clause = "deleted_at IS NULL")
public class FuzzyLogicResult extends BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "device_id", nullable = false)
        private Device device;

        @OneToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "sensor_data_id")
        private SensorData sensorData;

        @Column(name = "fuzzy_output")
        private Float fuzzyOutput;

        @Enumerated(EnumType.STRING)
        @Column(name = "irrigation_decision", length = 20)
        private IrrigationDecision irrigationDecision;

        @Column(name = "irrigation_duration")
        private Integer irrigationDuration;

        @Column(name = "confidence_score")
        private Float confidenceScore;

        @CreationTimestamp
        @Column(name = "timestamp", updatable = false)
        private LocalDateTime timestamp;

        @Column(name = "anfis_refined_duration")
        private Integer anfisRefinedDuration;

        @Column(name = "anfis_confidence")
        private Float anfisConfidence;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "ml_prediction_id")
        private MlPrediction mlPrediction;
}
