package com.example.smart_garden.service;

import com.example.smart_garden.entity.CropSeason;
import com.example.smart_garden.entity.DailyWaterBalance;
import com.example.smart_garden.entity.WeatherData;

/**
 * BatchJobService — Daily Scheduler.
 *
 * Runs daily at 6 AM to process all active CropSeasons:
 * 1. Fetch yesterday's weather data
 * 2. Iterate through active Crop_Seasons
 * 3. Invoke AgroPhysicsService for calculations
 * 4. Save results to daily_water_balance table
 */
public interface BatchJobService {

    /**
     * Main daily batch job entry point.
     * Called by @Scheduled or manually for testing.
     */
    void executeDailyWaterBalanceJob();

    /**
     * Hourly AI Prediction batch job.
     */
    void executeHourlyPredictionJob();

    /**
     * Process a single CropSeason — calculate today's water balance.
     *
     * @param season  The active crop season to process
     * @param weather Yesterday's weather data for the device location
     * @return The saved DailyWaterBalance record
     */
    DailyWaterBalance processSeason(CropSeason season, WeatherData weather);
}
