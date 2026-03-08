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

    /**
     * Weekly batch: collect labeled training samples from MlPrediction + IrrigationHistory,
     * then POST to /ai/train-batch if enough new samples are available.
     *
     * Runs Sunday 2:10 AM — after Job 4 (2:30 AM cleanup) has cleared stale data
     * but before the week's predict cycle.
     *
     * Logic:
     *   1. Scan MlPrediction records from [7, 14] days ago that have featuresUsed (real features)
     *   2. For each, look up IrrigationHistory within +2h window → actual water_mm applied
     *   3. If no irrigation found, use predictedDepl24h as proxy label
     *   4. Only retrain when >= MIN_TRAINING_SAMPLES new rows assembled
     */
    void executeWeeklyTrainingJob();
}
