package com.example.smart_garden.dto.weather.response;

import java.time.LocalDate;

/**
 * Response cho daily weather forecast từ OpenWeather.
 */
public record DailyWeatherForecastResponse(
        Long id,
        String location,
        LocalDate forecastDate,
        Float tempMin,
        Float tempMax,
        Float tempAvg,
        Float humidityAvg,
        Float windSpeedAvg,
        Float totalRain,
        Float precipProbAvg,
        Float avgClouds
) {
}
