package com.example.smart_garden.dto.weather;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * DTO mapping for OpenWeatherMap 5-day/3-hour Forecast API.
 * https://openweathermap.org/forecast5
 */
public record OpenWeatherForecastResponse(
        String cod,
        int message,
        int cnt,
        List<ForecastItem> list,
        City city) {
    public record ForecastItem(
            long dt,
            Main main,
            List<Weather> weather,
            Clouds clouds,
            Wind wind,
            int visibility,
            float pop, // Probability of precipitation
            Rain rain,
            Sys sys,
            @JsonProperty("dt_txt") String dtTxt) {
    }

    public record Main(
            double temp,
            @JsonProperty("feels_like") double feelsLike,
            @JsonProperty("temp_min") double tempMin,
            @JsonProperty("temp_max") double tempMax,
            int pressure,
            @JsonProperty("sea_level") int seaLevel,
            @JsonProperty("grnd_level") int grndLevel,
            int humidity,
            @JsonProperty("temp_kf") double tempKf) {
    }

    public record Weather(
            int id,
            String main,
            String description,
            String icon) {
    }

    public record Clouds(
            int all) {
    }

    public record Wind(
            double speed,
            int deg,
            double gust) {
    }

    public record Rain(
            @JsonProperty("3h") double threeH) {
    }

    public record Sys(
            String pod) {
    }

    public record City(
            long id,
            String name,
            Coord coord,
            String country,
            int population,
            int timezone,
            long sunrise,
            long sunset) {
    }

    public record Coord(
            double lat,
            double lon) {
    }
}
