package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.PredictionType;
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
@Table(name = "ml_prediction", indexes = {
                @Index(name = "idx_ml_prediction_device_created_at", columnList = "device_id, created_at")
})
@Where(clause = "deleted_at IS NULL")
public class MlPrediction extends BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "device_id", nullable = false)
        private Device device;

        @Builder.Default
        @Enumerated(EnumType.STRING)
        @Column(name = "prediction_type", length = 30, nullable = false)
        private PredictionType predictionType = PredictionType.WATER_NEED;

        @Column(name = "predicted_water_amount")
        private Float predictedWaterAmount;

        @Column(name = "predicted_duration")
        private Integer predictedDuration;

        @Builder.Default
        @Column(name = "prediction_horizon")
        private Integer predictionHorizon = 24;

        @Column(name = "model_accuracy")
        private Float modelAccuracy;

        @Column(name = "features_used", columnDefinition = "json")
        private String featuresUsed;

        @Column(name = "ai_output")
        private Float aiOutput;

        @Column(name = "ai_params", columnDefinition = "json")
        private String aiParams;

        @Column(name = "ai_accuracy")
        private Float aiAccuracy;

        // ===== New Expanded ML Features =====
        @Column(name = "etc")
        private Float etc;

        @Column(name = "raw_value")
        private Float raw;

        @Column(name = "deep_soil_moisture")
        private Float soilMoistDeep;

        @Column(name = "shallow_soil_moisture")
        private Float soilMoistShallow;

        @Column(name = "predicted_depl_24h")
        private Float predictedDepl24h;

        @Column(name = "soil_moist_deficit")
        private Float soilMoistDeficit;

        @Column(name = "soil_moist_trend_1h")
        private Float soilMoistTrend1h;

        @Column(name = "water_mm")
        private Float waterMm;

        // ===== Agro-Physics inputs =====

        @Column(name = "dc_input")
        private Float dcInput;

        @Column(name = "plant_age_input")
        private Integer plantAgeInput;

}
