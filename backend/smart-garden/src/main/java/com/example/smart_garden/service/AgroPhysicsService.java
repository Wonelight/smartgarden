package com.example.smart_garden.service;

import com.example.smart_garden.entity.CropLibrary;
import com.example.smart_garden.entity.WeatherData;

/**
 * AgroPhysicsService — Pure Calculation Engine.
 * Implements FAO-56 Penman-Monteith and Water Balance equations.
 * This service has NO database access — only math.
 */
public interface AgroPhysicsService {

    /**
     * Calculate Reference Evapotranspiration (ET₀) using FAO-56 Penman-Monteith
     * equation.
     *
     * @param weather  Weather data (temperature, humidity, solar radiation, wind
     *                 speed)
     * @param latitude Latitude in decimal degrees
     * @param altitude Altitude in meters above sea level
     * @return ET₀ in mm/day
     */
    double calculateET0(WeatherData weather, double latitude, double altitude);

    /**
     * Calculate current crop coefficient (Kc) by interpolating between growth
     * stages.
     *
     * @param crop         Crop profile from the library
     * @param plantAgeDays Age of the plant in days since planting
     * @return Current Kc value (interpolated)
     */
    double calculateKc(CropLibrary crop, int plantAgeDays);

    /**
     * Calculate Total Available Water (TAW) in the root zone.
     * TAW = (FC - PWP) × rootDepth / 100
     *
     * @param fieldCapacity Field Capacity (%)
     * @param wiltingPoint  Permanent Wilting Point (%)
     * @param rootDepth     Effective root depth (mm)
     * @return TAW in mm
     */
    double calculateTAW(double fieldCapacity, double wiltingPoint, double rootDepth);

    /**
     * Calculate daily root zone depletion using the Water Balance equation.
     * DC(today) = DC(yesterday) + ETc - EffectiveRain - Irrigation
     * Clamped to [0, TAW] range.
     *
     * @param prevDC        Previous day's depletion (mm)
     * @param etc           Crop evapotranspiration ETc = ET₀ × Kc (mm)
     * @param effectiveRain Effective rainfall (mm)
     * @param irrigation    Irrigation applied (mm)
     * @return Updated depletion DC (mm), clamped ≥ 0
     */
    double calculateDailyDepletion(double prevDC, double etc, double effectiveRain, double irrigation);

    /**
     * Estimate Solar Radiation (Rs) using the Hargreaves radiation formula.
     * Rs = kRs * sqrt(Tmax - Tmin) * Ra
     *
     * @param tMax      Maximum temperature (°C)
     * @param tMin      Minimum temperature (°C)
     * @param latitude  Latitude in decimal degrees
     * @param dayOfYear Day of the year (1-366)
     * @return Estimated Solar Radiation (MJ/m²/day)
     */
    double estimateSolarRadiation(double tMax, double tMin, double latitude, int dayOfYear);
}
