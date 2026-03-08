package com.example.smart_garden.service.impl;

import com.example.smart_garden.entity.*;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.entity.enums.DeviceStatus;
import com.example.smart_garden.dto.ai.request.AiPredictRequest;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.DailyWaterBalanceRepository;
import com.example.smart_garden.repository.IrrigationHistoryRepository;
import com.example.smart_garden.repository.MlPredictionRepository;
import com.example.smart_garden.repository.SensorDataHourlyRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.repository.WeatherDataRepository;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.AiPredictionService;
import com.example.smart_garden.service.BatchJobService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final IrrigationHistoryRepository irrigationHistoryRepository;
    private final MlPredictionRepository mlPredictionRepository;
    private final com.example.smart_garden.config.AiServiceProperties aiServiceProperties;
    private final org.springframework.web.client.RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /** Raw sensor data giữ lại (ngày). Sau đó chỉ còn hourly. */
    private static final int RAW_DATA_RETENTION_DAYS = 7;
    /** Hourly data giữ lại (ngày). */
    private static final int HOURLY_DATA_RETENTION_DAYS = 180;
    /** Batch size cho delete operations. */
    private static final int DELETE_BATCH_SIZE = 1000;
    /** Số mẫu training tối thiểu để trigger retrain. */
    private static final int MIN_TRAINING_SAMPLES = 50;
    /** Cửa sổ quét MlPrediction cho training (ngày). */
    private static final int TRAINING_SCAN_DAYS_FROM = 14;
    private static final int TRAINING_SCAN_DAYS_TO   = 7;
    /** Cửa sổ thời gian tìm IrrigationHistory sau prediction (phút). */
    private static final int IRRIGATION_MATCH_WINDOW_MINUTES = 120;

    // ================================================================
    // JOB 1: Daily Water Balance (existing — unchanged)
    // ================================================================

    /**
     * Scheduled daily at 6:05 AM (sau Job 2 chạy lúc 6:00 để tránh race condition).
     */
    @Override
    @Scheduled(cron = "0 5 6 * * ?")
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

        // 7. Get yesterday's irrigation amount from IrrigationHistory
        LocalDateTime yesterdayStart2 = today.minusDays(1).atStartOfDay();
        LocalDateTime todayStart = today.atStartOfDay();
        List<com.example.smart_garden.entity.IrrigationHistory> yesterdayIrrigations =
                irrigationHistoryRepository.findByDeviceIdAndStartTimeBetween(
                        device.getId(), yesterdayStart2, todayStart);
        double irrigationAmount = yesterdayIrrigations.stream()
                .filter(h -> h.getWaterVolume() != null)
                .mapToDouble(h -> h.getWaterVolume().doubleValue())
                .sum();

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

        log.info("Season #{} (device={}, crop={}): age={}d, ET0={:.2f} Kc={} ETc={} DC={}mm rec='{}'",
                season.getId(), device.getDeviceCode(), crop.getName(),
                plantAge,
                String.format("%.2f", et0),
                String.format("%.3f", kc),
                String.format("%.2f", etc),
                String.format("%.2f", dc),
                recommendation);

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

        // 2. Cleanup hourly sensor_data_hourly > 180 days (batch to avoid long table lock)
        LocalDateTime hourlyCutoff = LocalDateTime.now().minusDays(HOURLY_DATA_RETENTION_DAYS);
        int totalHourlyDeleted = 0;
        int hourlyBatch;
        do {
            List<Long> ids = sensorDataHourlyRepository
                    .findTop1000ByHourStartBeforeOrderByHourStartAsc(hourlyCutoff)
                    .stream().map(SensorDataHourly::getId).collect(Collectors.toList());
            if (ids.isEmpty()) break;
            sensorDataHourlyRepository.deleteAllByIdInBatch(ids);
            totalHourlyDeleted += ids.size();
            hourlyBatch = ids.size();
        } while (hourlyBatch == DELETE_BATCH_SIZE);

        log.info("🗑️ DATA RETENTION CLEANUP COMPLETE: deleted {} raw records (>{} days), deleted {} hourly records (>{} days)",
                totalRawDeleted, RAW_DATA_RETENTION_DAYS, totalHourlyDeleted, HOURLY_DATA_RETENTION_DAYS);
    }

    // ================================================================
    // JOB 5: Weekly Model Training
    // ================================================================

    /**
     * Chạy hàng tuần vào Chủ nhật 2:10 AM.
     *
     * Pipeline:
     *   1. Quét MlPrediction cũ [7-14 ngày] có featuresUsed (features thực)
     *   2. Với mỗi prediction, tìm IrrigationHistory trong +2h tiếp theo:
     *      → label = waterVolume (L) / gardenArea (m²) × 1000 = mm thực tế đã tưới
     *   3. Nếu không có irrigation → label = predictedDepl24h (proxy: model báo thiếu)
     *   4. Đủ MIN_TRAINING_SAMPLES? → POST /ai/train-batch → Python retrain
     */
    @Override
    @Scheduled(cron = "0 10 2 * * SUN")
    @Transactional(readOnly = true)
    public void executeWeeklyTrainingJob() {
        log.info("========== WEEKLY TRAINING JOB STARTED ==========");

        LocalDateTime scanFrom = LocalDateTime.now().minusDays(TRAINING_SCAN_DAYS_FROM);
        LocalDateTime scanTo   = LocalDateTime.now().minusDays(TRAINING_SCAN_DAYS_TO);

        List<MlPrediction> candidates = mlPredictionRepository.findTrainablePredictions(scanFrom, scanTo);
        log.info("Found {} trainable MlPrediction records in [{}, {}]", candidates.size(), scanFrom, scanTo);

        if (candidates.isEmpty()) {
            log.info("No trainable predictions found. Skipping training.");
            return;
        }

        // ── Build training samples ──────────────────────────────────────
        List<Map<String, Object>> samples = new ArrayList<>();

        for (MlPrediction pred : candidates) {
            try {
                // 1. Parse featuresUsed JSON
                Map<String, Object> features = objectMapper.readValue(
                        pred.getFeaturesUsed(), new TypeReference<>() {});

                // 2. Determine label: actual mm from irrigation, or proxy from prediction
                double labelMm;
                Device device = pred.getDevice();
                LocalDateTime predTime = pred.getCreatedAt();
                LocalDateTime windowEnd = predTime.plusMinutes(IRRIGATION_MATCH_WINDOW_MINUTES);

                List<IrrigationHistory> irrigations = irrigationHistoryRepository
                        .findByDeviceIdAndStartTimeBetween(device.getId(), predTime, windowEnd);

                if (!irrigations.isEmpty()) {
                    // Tổng nước thực tế tưới trong cửa sổ
                    double totalWaterVolumeLiters = irrigations.stream()
                            .filter(h -> h.getWaterVolume() != null)
                            .mapToDouble(h -> h.getWaterVolume().doubleValue())
                            .sum();
                    double gardenArea = device.getGardenArea() != null ? device.getGardenArea() : 1.0;
                    // Chuyển L → mm: (L / m²) × 1000 → mm; 1 L/m² = 1 mm
                    labelMm = totalWaterVolumeLiters / gardenArea;
                } else {
                    // Proxy label: mô hình báo cần bao nhiêu mm
                    labelMm = pred.getPredictedDepl24h() != null ? pred.getPredictedDepl24h() : 0.0;
                }

                // Bỏ qua mẫu label = 0 và không có irrigation (nhiễu)
                if (labelMm <= 0.0 && irrigations.isEmpty()) {
                    continue;
                }

                Map<String, Object> sample = new LinkedHashMap<>();
                sample.put("features", features);
                sample.put("actual_depletion_mm", labelMm);
                sample.put("device_id", device.getId());
                sample.put("prediction_id", pred.getId());
                sample.put("label_source", irrigations.isEmpty() ? "proxy_model" : "actual_irrigation");
                samples.add(sample);

            } catch (Exception e) {
                log.warn("Skipping prediction #{} — failed to build sample: {}", pred.getId(), e.getMessage());
            }
        }

        log.info("Built {} training samples ({} from actual irrigation, {} proxy)",
                samples.size(),
                samples.stream().filter(s -> "actual_irrigation".equals(s.get("label_source"))).count(),
                samples.stream().filter(s -> "proxy_model".equals(s.get("label_source"))).count());

        // ── Check threshold ──────────────────────────────────────────
        if (samples.size() < MIN_TRAINING_SAMPLES) {
            log.info("Only {} samples < MIN_TRAINING_SAMPLES ({}). Skipping retrain this week.",
                    samples.size(), MIN_TRAINING_SAMPLES);
            return;
        }

        // ── POST to ai-service /ai/train-batch ───────────────────────
        try {
            Map<String, Object> trainPayload = new LinkedHashMap<>();
            trainPayload.put("samples", samples);
            trainPayload.put("n_samples", samples.size());

            String url = aiServiceProperties.getUrl() + "/ai/train-batch";
            log.info("Sending {} training samples to {}", samples.size(), url);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, trainPayload, Map.class);

            if (response != null) {
                log.info("========== WEEKLY TRAINING JOB COMPLETE: r2={}, mae={}, n_samples={} ==========",
                        response.get("r2"), response.get("mae"), response.get("n_samples"));
            } else {
                log.warn("Training response was null — ai-service may have failed silently");
            }
        } catch (Exception e) {
            log.error("Weekly training job failed when calling ai-service: {}", e.getMessage(), e);
        }
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
