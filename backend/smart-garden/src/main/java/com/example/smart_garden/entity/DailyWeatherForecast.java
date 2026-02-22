package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Where;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "daily_weather_forecast", indexes = {
        @Index(name = "idx_forecast_location_date", columnList = "location, forecast_date", unique = true)
})
@Where(clause = "deleted_at IS NULL")
public class DailyWeatherForecast extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location", nullable = false, length = 255)
    private String location;

    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    @Column(name = "temp_min")
    private Float tempMin;

    @Column(name = "temp_max")
    private Float tempMax;

    @Column(name = "temp_avg")
    private Float tempAvg; // Mean of 3h temps

    @Column(name = "humidity_avg")
    private Float humidityAvg;

    @Column(name = "wind_speed_avg")
    private Float windSpeedAvg;

    @Column(name = "total_rain")
    private Float totalRain; // Sum of 3h rain

    @Column(name = "precip_prob_avg")
    private Float precipProbAvg; // Avg of POP

    @Column(name = "avg_clouds")
    private Float avgClouds;
}
