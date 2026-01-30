package com.example.smart_garden.entity;

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
@Table(name = "irrigation_config")
@Where(clause = "deleted_at IS NULL")
public class IrrigationConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", unique = true)
    private Device device;

    @Column(name = "soil_moisture_min")
    private Float soilMoistureMin = 20.0f;

    @Column(name = "soil_moisture_max")
    private Float soilMoistureMax = 60.0f;

    @Column(name = "soil_moisture_optimal")
    private Float soilMoistureOptimal = 40.0f;

    @Column(name = "temp_min")
    private Float tempMin = 15.0f;

    @Column(name = "temp_max")
    private Float tempMax = 35.0f;

    @Column(name = "light_threshold")
    private Float lightThreshold = 1000.0f;

    @Column(name = "irrigation_duration_min")
    private Integer irrigationDurationMin = 30;

    @Column(name = "irrigation_duration_max")
    private Integer irrigationDurationMax = 300;

    @Column(name = "fuzzy_enabled")
    private Boolean fuzzyEnabled = true;

    @Column(name = "auto_mode")
    private Boolean autoMode = true;

}

