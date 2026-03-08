package com.example.smart_garden.service.impl;

import com.example.smart_garden.entity.*;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.entity.enums.DeviceStatus;
import com.example.smart_garden.dto.ai.request.AiPredictRequest;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.DailyWaterBalanceRepository;
import com.example.smart_garden.repository.SensorDataHourlyRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.repository.WeatherDataRepository;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.AiPredictionService;
import com.example.smart_garden.service.BatchJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of BatchJobService.
 *
 * Scheduled jobs:
 * 1. Daily 6:00 AM — Water balance calculation for active crop seasons
 * 2. Hourly :05 — Aggregate raw sensor_data → sensor_data_hourly
 * 3. Daily 2:30 AM — Cleanup old raw sensor data + old hourly data
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchJobServiceImpl implements BatchJobService {

    private final CropSeasonRepository cropSeasonRepository;
    private final DailyWaterBalanceRepository dailyWaterBalanceRepository;
    private final WeatherDataRepository weatherDataRepository;
    private final AgroPhysicsService agroPhysicsService;
    private final SensorDataRepository sensorDataRepository;
    private final SensorDataHourlyRepository sensorDataHourlyRepository;
    private final AiPredictionService aiPredictionService;

    /** Raw sensor data giữ lại (ngày). Sau đó chỉ còn hourly. */
    private static final int RAW_DATA_RETENTION_DAYS = 7;
    /** Hourly data giữ lại (ngày). */
    private static final int HOURLY_DATA_RETENTION_DAYS = 180;
    /** Batch size cho delete operations. */
    private static final int DELETE_BATCH_SIZE = 1000;

    // ================================================================
    // JOB 1: Daily Water Balance (existing — unchanged)
    // ================================================================

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

    // ================================================================
    // JOB 2: Hourly AI Prediction
    // ================================================================

    /**
     * Chạy mỗi giờ tại phút 00.
     * Tự động gọi API dự đoán AI cho các thiết bị đang có mùa vụ active.
     * Bỏ qua các thiết bị đã OFFLINE hơn 2 giờ.
     */
    @Override
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void executeHourlyPredictionJob() {
        log.info("========== HOURLY AI PREDICTION JOB STARTED ==========");

        List<CropSeason> activeSeasons = cropSeasonRepository.findByStatus(CropSeasonStatus.ACTIVE);
        log.info("Found {} active crop seasons to consider for AI prediction", activeSeasons.size());

        int success = 0;
        int skipped = 0;
        int failed = 0;

        for (CropSeason season : activeSeasons) {
            Device device = season.getDevice();
            if (device == null)
                continue;

            // Check if device is offline for > 2 hours
            if (DeviceStatus.OFFLINE.equals(device.getStatus())) {
                LocalDateTime lastOnline = device.getLastOnline();
                if (lastOnline == null || lastOnline.isBefore(LocalDateTime.now().minusHours(2))) {
                    log.info("Device {} is OFFLINE for > 2 hours (last online: {}). Skipping ML Prediction.",
                            device.getDeviceCode(), lastOnline);
                    skipped++;
                    continue;
                }
            }

            try {
                AiPredictRequest req = new AiPredictRequest(device.getId(), null);
                aiPredictionService.predict(req);
                success++;
            } catch (Exception e) {
                log.error("Failed AI prediction for device {}: {}", device.getDeviceCode(), e.getMessage());
                failed++;
            }
        }

        log.info("========== HOURLY AI PREDICTION JOB COMPLETED: {} success, {} skipped, {} failed ==========",
                success, skipped, failed);
    }

    // ================================================================
    // JOB 3: Hourly Sensor Data Aggregation
    // ================================================================

    /**
     * Chạy mỗi giờ tại phút thứ 5 (e.g., 14:05, 15:05, ...).
     * Aggregate raw sensor_data của giờ trước → sensor_data_hourly.
     *
     * Từ JSON payload, extract từng metric → tính AVG/MIN/MAX.
     */
    @Scheduled(cron = "0 5 * * * ?")
    @Transactional
    public void executeHourlyAggregationJob() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime hourStart = now.truncatedTo(ChronoUnit.HOURS).minusHours(1);
        LocalDateTime hourEnd = hourStart.plusHours(1);

        log.info("⏱️ HOURLY AGGREGATION: processing {} to {}", hourStart, hourEnd);

        // Fetch all raw sensor data for the previous hour
        List<SensorData> rawData = sensorDataRepository.findAllByTimestampBetween(hourStart, hourEnd);
        if (rawData.isEmpty()) {
            log.info("⏱️ No raw sensor data for {}, skipping aggregation", hourStart);
            return;
        }

        // Group by device
        Map<Long, List<SensorData>> byDevice = rawData.stream()
                .filter(sd -> sd.getDevice() != null)
                .collect(Collectors.groupingBy(sd -> sd.getDevice().getId()));

        int created = 0;
        for (Map.Entry<Long, List<SensorData>> entry : byDevice.entrySet()) {
            Long deviceId = entry.getKey();
            List<SensorData> deviceData = entry.getValue();

            try {
                // Skip if already aggregated
                if (sensorDataHourlyRepository.findByDeviceIdAndHourStart(deviceId, hourStart).isPresent()) {
                    continue;
                }

                SensorDataHourly hourly = aggregateToHourly(deviceData, hourStart);
                sensorDataHourlyRepository.save(hourly);
                created++;
            } catch (Exception e) {
                log.error("Failed to aggregate hourly data for device {} at {}: {}",
                        deviceId, hourStart, e.getMessage());
            }
        }

        log.info("⏱️ HOURLY AGGREGATION COMPLETE: {} devices aggregated, {} raw records processed",
                created, rawData.size());
    }

    /**
     * Aggregate danh sách SensorData (cùng device, cùng giờ) → SensorDataHourly.
     */
    private SensorDataHourly aggregateToHourly(List<SensorData> data, LocalDateTime hourStart) {
        Device device = data.get(0).getDevice();

        // Collect non-null values per metric
        List<Float> soilMoist1 = new ArrayList<>();
        List<Float> soilMoist2 = new ArrayList<>();
        List<Float> temps = new ArrayList<>();
        List<Float> humids = new ArrayList<>();
        List<Float> lights = new ArrayList<>();
        List<Float> rainInts = new ArrayList<>();
        int rainCount = 0;

        for (SensorData sd : data) {
            if (sd.getSoilMoisture() != null)
                soilMoist1.add(sd.getSoilMoisture());
            if (sd.getSoilMoisture2() != null)
                soilMoist2.add(sd.getSoilMoisture2());
            if (sd.getTemperature() != null)
                temps.add(sd.getTemperature());
            if (sd.getHumidity() != null)
                humids.add(sd.getHumidity());
            if (sd.getLightIntensity() != null)
                lights.add(sd.getLightIntensity());
            if (sd.getRainIntensity() != null)
                rainInts.add(sd.getRainIntensity());
            if (Boolean.TRUE.equals(sd.getRainDetected()))
                rainCount++;
        }

        return SensorDataHourly.builder()
                .device(device)
                .hourStart(hourStart)
                // Soil 1
                .avgSoilMoisture(avg(soilMoist1))
                .minSoilMoisture(min(soilMoist1))
                .maxSoilMoisture(max(soilMoist1))
                // Soil 2
                .avgSoilMoisture2(avg(soilMoist2))
                .minSoilMoisture2(min(soilMoist2))
                .maxSoilMoisture2(max(soilMoist2))
                // Temperature
                .avgTemperature(avg(temps))
                .minTemperature(min(temps))
                .maxTemperature(max(temps))
                // Humidity
                .avgHumidity(avg(humids))
                .minHumidity(min(humids))
                .maxHumidity(max(humids))
                // Light
                .avgLightIntensity(avg(lights))
                .minLightIntensity(min(lights))
                .maxLightIntensity(max(lights))
                // Rain
                .avgRainIntensity(avg(rainInts))
                .rainDetectedCount(rainCount)
                // Meta
                .sampleCount(data.size())
                .build();
    }

    // ================================================================
    // JOB 3: Data Retention Cleanup
    // ================================================================

    /**
     * Chạy hàng ngày 2:30 AM — xóa dữ liệu cũ:
     * - Raw sensor_data > 7 ngày
     * - Hourly sensor_data_hourly > 180 ngày
     *
     * Batch delete 1000 records/lần để tránh lock table quá lâu.
     */
    @Scheduled(cron = "0 30 2 * * ?")
    @Transactional
    public void executeDataRetentionCleanup() {
        log.info("🗑️ DATA RETENTION CLEANUP STARTED");

        // 1. Cleanup raw sensor_data > 7 days
        LocalDateTime rawCutoff = LocalDateTime.now().minusDays(RAW_DATA_RETENTION_DAYS);
        int totalRawDeleted = 0;
        int batch;
        do {
            batch = sensorDataRepository.deleteOldDataInBatch(rawCutoff, DELETE_BATCH_SIZE);
            totalRawDeleted += batch;
            if (batch > 0) {
                log.debug("Deleted batch of {} raw sensor records", batch);
            }
        } while (batch == DELETE_BATCH_SIZE);

        // 2. Cleanup hourly sensor_data_hourly > 180 days
        LocalDateTime hourlyCutoff = LocalDateTime.now().minusDays(HOURLY_DATA_RETENTION_DAYS);
        sensorDataHourlyRepository.deleteByHourStartBefore(hourlyCutoff);

        log.info("🗑️ DATA RETENTION CLEANUP COMPLETE: deleted {} raw records (>{} days), hourly cutoff={}",
                totalRawDeleted, RAW_DATA_RETENTION_DAYS, hourlyCutoff);
    }

    // ================================================================
    // Helper: float statistics
    // ================================================================

    private static Float avg(List<Float> values) {
        if (values.isEmpty())
            return null;
        return (float) values.stream().mapToDouble(Float::doubleValue).average().orElse(0);
    }

    private static Float min(List<Float> values) {
        if (values.isEmpty())
            return null;
        return values.stream().min(Float::compareTo).orElse(null);
    }

    private static Float max(List<Float> values) {
        if (values.isEmpty())
            return null;
        return values.stream().max(Float::compareTo).orElse(null);
    }
}
