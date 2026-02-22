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
@Table(name = "weather_data", indexes = {
                @Index(name = "idx_weather_data_location_forecast_time", columnList = "location, forecast_time")
})
@Where(clause = "deleted_at IS NULL")
public class WeatherData extends BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(name = "location", nullable = false, length = 255)
        private String location;

        @Column(name = "temperature")
        private Float temperature;

        @Column(name = "humidity")
        private Float humidity;

        @Column(name = "precipitation")
        private Float precipitation;

        @Column(name = "precipitation_probability")
        private Float precipitationProbability;

        @Column(name = "wind_speed")
        private Float windSpeed;

        @Column(name = "uv_index")
        private Float uvIndex;

        @Column(name = "forecast_time")
        private LocalDateTime forecastTime;

        // ===== Agro-Physics: Penman-Monteith inputs =====

        @Column(name = "solar_radiation")
        private Float solarRadiation;

        @Column(name = "sunshine_hours")
        private Float sunshineHours;

        @Column(name = "wind_speed_2m")
        private Float windSpeed2m;

        @Column(name = "atmospheric_pressure")
        private Float atmosphericPressure;

}
