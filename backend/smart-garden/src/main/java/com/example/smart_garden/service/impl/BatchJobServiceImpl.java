package com.example.smart_garden.service.impl;

import com.example.smart_garden.entity.*;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.DailyWaterBalanceRepository;
import com.example.smart_garden.repository.WeatherDataRepository;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.BatchJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Implementation of BatchJobService.
 *
 * Runs daily at 6:00 AM to calculate water balance for all active crop seasons.
 * This is the "heartbeat" of the predictive irrigation system.
 *
 * Workflow:
 * 1. Fetch all ACTIVE CropSeasons
 * 2. For each season, find the device's location and fetch yesterday's weather
 * 3. Calculate ET₀, Kc, ETc, and update root zone depletion (DC)
 * 4. Generate a recommendation based on DC vs. allowable depletion
 * 5. Persist to daily_water_balance table
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchJobServiceImpl implements BatchJobService {

    private final CropSeasonRepository cropSeasonRepository;
    private final DailyWaterBalanceRepository dailyWaterBalanceRepository;
    private final WeatherDataRepository weatherDataRepository;
    private final AgroPhysicsService agroPhysicsService;

    /**
     * Scheduled daily at 6:00 AM.
     */
    @Override
    @Scheduled(cron = "0 0 6 * * ?")
    @Transactional
    public void executeDailyWaterBalanceJob() {
        log.info("========== DAILY WATER BALANCE JOB STARTED ==========");

        List<CropSeason> activeSeasons = cropSeasonRepository.findByStatus(CropSeasonStatus.ACTIVE);
        log.info("Found {} active crop seasons to process", activeSeasons.size());

        int success = 0;
        int failed = 0;

        for (CropSeason season : activeSeasons) {
            try {
                // Find yesterday's weather for the device's location
                Device device = season.getDevice();
                String location = device.getLocation();

                LocalDateTime yesterdayStart = LocalDate.now().minusDays(1).atStartOfDay();
                LocalDateTime yesterdayEnd = LocalDate.now().atStartOfDay();

                // Find the most recent weather data for this location
                Optional<WeatherData> weatherOpt = weatherDataRepository
                        .findTopByLocationAndForecastTimeBetweenOrderByForecastTimeDesc(
                                location, yesterdayStart, yesterdayEnd);

                if (weatherOpt.isEmpty()) {
                    log.warn("No weather data found for location '{}' (device: {}). Skipping season #{}",
                            location, device.getDeviceCode(), season.getId());
                    failed++;
                    continue;
                }

                processSeason(season, weatherOpt.get());
                success++;

            } catch (Exception e) {
                log.error("Error processing season #{}: {}", season.getId(), e.getMessage(), e);
                failed++;
            }
        }

        log.info("========== DAILY WATER BALANCE JOB COMPLETED: {} success, {} failed ==========",
                success, failed);
    }

    @Override
    @Transactional
    public DailyWaterBalance processSeason(CropSeason season, WeatherData weather) {
        Device device = season.getDevice();
        CropLibrary crop = season.getCrop();
        SoilLibrary soil = season.getSoil();
        LocalDate today = LocalDate.now();

        // 1. Calculate plant age
        int plantAge = (int) ChronoUnit.DAYS.between(season.getStartDate(), today);

        // 2. Calculate ET₀
        double latitude = device.getLatitude() != null ? device.getLatitude() : 10.8231; // Default: Ho Chi Minh City
        double altitude = device.getAltitude() != null ? device.getAltitude() : 19.0; // Default: HCM altitude
        double et0 = agroPhysicsService.calculateET0(weather, latitude, altitude);

        // 3. Calculate Kc (crop coefficient)
        double kc = agroPhysicsService.calculateKc(crop, plantAge);

        // 4. Calculate ETc = ET₀ × Kc
        double etc = et0 * kc;

        // 5. Effective rainfall (simple: 80% of precipitation, or 0 if no rain)
        double rainfall = weather.getPrecipitation() != null ? weather.getPrecipitation() : 0.0;
        double effectiveRain = rainfall * 0.8;

        // 6. Get previous DC (depletion)
        double prevDC = 0.0;
        Optional<DailyWaterBalance> prevBalance = dailyWaterBalanceRepository
                .findTopByCropSeasonIdOrderByDateDesc(season.getId());
        if (prevBalance.isPresent()) {
            prevDC = prevBalance.get().getDcValue() != null ? prevBalance.get().getDcValue() : 0.0;
        }

        // 7. Get yesterday's irrigation amount (if any — from irrigation history)
        double irrigationAmount = 0.0; // TODO: integrate with IrrigationHistory

        // 8. Calculate today's depletion
        double dc = agroPhysicsService.calculateDailyDepletion(prevDC, etc, effectiveRain, irrigationAmount);

        // 9. Calculate TAW and generate recommendation
        double rootDepth = season.getInitialRootDepth() != null ? season.getInitialRootDepth() : crop.getMaxRootDepth();
        double taw = agroPhysicsService.calculateTAW(
                soil.getFieldCapacity(), soil.getWiltingPoint(), rootDepth);

        double depletionFraction = crop.getDepletionFraction() != null ? crop.getDepletionFraction() : 0.5;
        double allowableDepletion = taw * depletionFraction; // RAW = p × TAW

        String recommendation = generateRecommendation(dc, allowableDepletion, taw);

        // 10. Save daily water balance record
        DailyWaterBalance balance = DailyWaterBalance.builder()
                .cropSeason(season)
                .date(today)
                .cropAge(plantAge)
                .et0Value((float) et0)
                .kcCurrent((float) kc)
                .etcValue((float) etc)
                .effectiveRain((float) effectiveRain)
                .irrigationAmount((float) irrigationAmount)
                .dcValue((float) dc)
                .recommendation(recommendation)
                .build();

        balance = dailyWaterBalanceRepository.save(balance);

        log.info("Season #{} (device={}, crop={}): age={}d, ET₀={:.2f}, Kc={:.3f}, ETc={:.2f}, DC={:.2f}mm, rec='{}'",
                season.getId(), device.getDeviceCode(), crop.getName(),
                plantAge, et0, kc, etc, dc, recommendation);

        return balance;
    }

    /**
     * Generate irrigation recommendation based on depletion level.
     */
    private String generateRecommendation(double dc, double allowableDepletion, double taw) {
        double ratio = dc / Math.max(taw, 0.01);

        if (dc <= allowableDepletion * 0.5) {
            return String.format("NO_IRRIGATION_NEEDED — Soil moisture adequate (DC=%.1fmm, %.0f%% of TAW)", dc,
                    ratio * 100);
        } else if (dc <= allowableDepletion) {
            return String.format("MONITOR — Approaching depletion threshold (DC=%.1fmm, %.0f%% of TAW)", dc,
                    ratio * 100);
        } else if (dc <= taw * 0.8) {
            double irrigationNeeded = dc - allowableDepletion * 0.3;
            return String.format(
                    "IRRIGATE_RECOMMENDED — Deficit exceeds threshold (DC=%.1fmm, suggest %.1fmm irrigation)", dc,
                    irrigationNeeded);
        } else {
            double irrigationNeeded = dc;
            return String.format(
                    "IRRIGATE_URGENT — Severe water deficit (DC=%.1fmm, need %.1fmm irrigation immediately)", dc,
                    irrigationNeeded);
        }
    }
}
