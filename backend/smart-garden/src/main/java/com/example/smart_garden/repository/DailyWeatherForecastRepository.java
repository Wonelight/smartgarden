package com.example.smart_garden.repository;

import com.example.smart_garden.entity.DailyWeatherForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyWeatherForecastRepository extends JpaRepository<DailyWeatherForecast, Long> {

    Optional<DailyWeatherForecast> findByLocationAndForecastDate(String location, LocalDate forecastDate);

    List<DailyWeatherForecast> findByLocationAndForecastDateBetween(String location, LocalDate startDate,
            LocalDate endDate);

    // Cleanup old forecasts
    @Modifying
    @Query("DELETE FROM DailyWeatherForecast d WHERE d.forecastDate < :date")
    void deleteOlderThan(LocalDate date);
}
