package com.example.smart_garden.service;

import com.example.smart_garden.dto.weather.response.DailyWeatherForecastResponse;
import com.example.smart_garden.dto.monitoring.response.WeatherDataDetailResponse;

import java.util.List;
import java.util.Map;

/**
 * Service for fetching and managing weather data from OpenWeatherMap.
 */
public interface WeatherService {

    /**
     * Fetch weather for all unique device locations immediately.
     * Used by scheduler and manual trigger.
     */
    void fetchWeatherForAllDevices();

    /**
     * Fetch weather for a specific device's location.
     */
    void fetchWeatherForDevice(Long deviceId);

    /**
     * Get a summary of monitored locations.
     * 
     * @return Map of "lat,lon" -> count of devices
     */
    Map<String, Integer> getMonitoredLocations();

    /**
     * Get current weather data for a location.
     * 
     * @param location Location name or "lat,lon" format
     * @return Latest weather data or null if not found
     */
    WeatherDataDetailResponse getCurrentWeather(String location);

    /**
     * Get 5-day weather forecast for a location.
     * 
     * @param location Location name or "lat,lon" format
     * @return List of daily forecasts (up to 5 days)
     */
    List<DailyWeatherForecastResponse> getWeatherForecast(String location);
}
