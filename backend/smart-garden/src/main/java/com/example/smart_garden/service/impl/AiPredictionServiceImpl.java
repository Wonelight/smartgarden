package com.example.smart_garden.service.impl;

import com.example.smart_garden.config.AiServiceProperties;
import com.example.smart_garden.dto.ai.request.AiPredictRequest;
import com.example.smart_garden.dto.ai.request.AiTrainRequest;
import com.example.smart_garden.dto.ai.response.AiPredictResponse;
import com.example.smart_garden.dto.ai.response.AiTrainResponse;
import com.example.smart_garden.dto.monitoring.response.MlPredictionDetailResponse;
import com.example.smart_garden.entity.*;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.entity.enums.PredictionType;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.*;
import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.AiPredictionService;
import com.example.smart_garden.service.WaterBalanceStateService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation của AiPredictionService.
 * Gọi Python AI service qua REST, gửi payload đầy đủ:
 * sensors + openweather + crop context.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiPredictionServiceImpl implements AiPredictionService {

    private final RestTemplate restTemplate;
    private final AiServiceProperties aiServiceProperties;
    private final MlPredictionRepository mlPredictionRepository;
    private final SensorDataRepository sensorDataRepository;
    private final IrrigationConfigRepository irrigationConfigRepository;
    private final FuzzyLogicResultRepository fuzzyLogicResultRepository;
    private final DeviceRepository deviceRepository;
    private final WeatherDataRepository weatherDataRepository;
    private final CropSeasonRepository cropSeasonRepository;
    private final DailyWeatherForecastRepository dailyWeatherForecastRepository;
    private final AgroPhysicsService agroPhysicsService;
    private final WaterBalanceStateService waterBalanceStateService;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter ISO_DATE_TIME = DateTimeFormatter.ISO_DATE_TIME;

    // ================== PREDICT ==================

    @Override
    @Transactional
    public AiPredictResponse predict(AiPredictRequest request) {
        // 1. Validate device
        Device device = deviceRepository.findById(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // 2. Check AI enabled
        IrrigationConfig config = irrigationConfigRepository.findByDeviceId(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.IRRIGATION_CONFIG_NOT_FOUND));
        if (!Boolean.TRUE.equals(config.getAiEnabled())) {
            throw new AppException(ErrorCode.AI_SERVICE_NOT_ENABLED);
        }

        // 3. Fetch sensor data
        SensorData sensorData = sensorDataRepository.findById(request.sensorDataId())
                .orElseThrow(() -> new AppException(ErrorCode.SENSOR_NOT_FOUND));

        // 4. Build rich payload
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("device_id", request.deviceId());
        payload.put("sensor_data_id", request.sensorDataId());
        payload.put("sensors", buildSensorPayload(sensorData));
        payload.put("openweather", buildWeatherPayload(device));
        payload.put("crop", buildCropPayload(device));
        // Single source of truth: state từ DB, gửi kèm để AI không cần GET/PUT
        payload.put("water_balance", buildWaterBalancePayload(waterBalanceStateService.getState(request.deviceId())));

        // 5. Call Python AI service
        Map<String, Object> pythonResponse = callPythonService(
                aiServiceProperties.getPredictEndpoint(), payload, "prediction", request.deviceId());

        // 6. Parse response & save MlPrediction
        Float aiOutput = parseFloat(pythonResponse.get("ai_output"));
        Float confidence = parseFloat(pythonResponse.get("confidence"));
        Integer predictedDuration = parseInteger(pythonResponse.get("predicted_duration"));
        Integer refinedDuration = parseInteger(pythonResponse.get("refined_duration"));

        MlPrediction prediction = MlPrediction.builder()
                .device(device)
                .predictionType(PredictionType.WATER_NEED)
                .predictedDuration(predictedDuration)
                .anfisOutput(aiOutput)
                .anfisAccuracy(parseFloat(pythonResponse.get("accuracy")))
                .build();

        // Save AI params as JSON if present
        Object paramsObj = pythonResponse.get("ai_params");
        if (paramsObj != null) {
            try {
                prediction.setAnfisParams(objectMapper.writeValueAsString(paramsObj));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize AI params: {}", e.getMessage());
            }
        }

        prediction = mlPredictionRepository.save(prediction);
        log.info("Saved AI prediction {} for device {}", prediction.getId(), request.deviceId());

        // 7. Persist updated water balance from AI (single source of truth: chỉ backend ghi DB)
        persistUpdatedWaterBalanceFromResponse(request.deviceId(), pythonResponse);

        // 8. Update FuzzyLogicResult if exists
        FuzzyLogicResult latestFuzzy = fuzzyLogicResultRepository
                .findFirstByDeviceIdOrderByTimestampDesc(request.deviceId())
                .orElse(null);
        if (latestFuzzy != null && refinedDuration != null) {
            latestFuzzy.setAnfisRefinedDuration(refinedDuration);
            latestFuzzy.setAnfisConfidence(confidence);
            latestFuzzy.setMlPrediction(prediction);
            fuzzyLogicResultRepository.save(latestFuzzy);
            log.info("Updated FuzzyLogicResult {} with AI refinement", latestFuzzy.getId());
        }

        return new AiPredictResponse(
                prediction.getId(),
                request.deviceId(),
                predictedDuration,
                aiOutput,
                confidence,
                refinedDuration,
                prediction.getCreatedAt());
    }

    // ================== TRAIN ==================

    @Override
    @Transactional
    public AiTrainResponse train(AiTrainRequest request) {
        // 1. Validate device
        Device device = deviceRepository.findById(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // 2. Fetch historical data for training
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = endTime.minusDays(30);
        List<MlPrediction> historicalData = mlPredictionRepository
                .findByDeviceIdAndCreatedAtBetween(request.deviceId(), startTime, endTime);

        // 3. Build payload
        Map<String, Object> payload = new HashMap<>();
        payload.put("device_id", request.deviceId());
        payload.put("epochs", request.epochs() != null
                ? request.epochs()
                : aiServiceProperties.getDefaultEpochs());
        payload.put("learning_rate", request.learningRate() != null
                ? request.learningRate()
                : aiServiceProperties.getDefaultLearningRate());
        payload.put("data_count", historicalData.size());

        // 4. Call Python AI training service
        Map<String, Object> pythonResponse = callPythonService(
                aiServiceProperties.getTrainEndpoint(), payload, "training", request.deviceId());

        // 5. Save trained params into MlPrediction
        Float accuracy = parseFloat(pythonResponse.get("accuracy"));
        String status = pythonResponse.get("status") != null
                ? pythonResponse.get("status").toString()
                : "completed";

        MlPrediction prediction = MlPrediction.builder()
                .device(device)
                .predictionType(PredictionType.WATER_NEED)
                .anfisAccuracy(accuracy)
                .modelAccuracy(accuracy)
                .build();

        Object paramsObj = pythonResponse.get("trained_params");
        Map<String, Object> paramsMap = null;
        if (paramsObj != null) {
            try {
                String paramsJson = objectMapper.writeValueAsString(paramsObj);
                prediction.setAnfisParams(paramsJson);
                paramsMap = objectMapper.readValue(paramsJson, new TypeReference<>() {
                });
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize AI trained params: {}", e.getMessage());
            }
        }

        prediction = mlPredictionRepository.save(prediction);
        log.info("Saved AI training result {} for device {}", prediction.getId(), request.deviceId());

        return new AiTrainResponse(
                prediction.getId(),
                request.deviceId(),
                accuracy,
                status,
                paramsMap,
                prediction.getCreatedAt());
    }

    // ================== GET LATEST ==================

    @Override
    @Transactional(readOnly = true)
    public MlPredictionDetailResponse getLatestResult(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        MlPrediction prediction = mlPredictionRepository
                .findFirstByDeviceIdOrderByCreatedAtDesc(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.ML_PREDICTION_NOT_FOUND));

        return toDetailResponse(prediction);
    }

    // ================== PAYLOAD BUILDERS ==================

    /**
     * Build water_balance payload block từ state trong DB (single source of truth).
     * AI nhận snapshot này trong request, không cần GET state từ backend.
     * Snake_case để khớp contract Python.
     */
    private Map<String, Object> buildWaterBalancePayload(WaterBalanceStateResponse state) {
        Map<String, Object> wb = new LinkedHashMap<>();
        wb.put("shallow_depletion", state.shallowDepletion());
        wb.put("deep_depletion", state.deepDepletion());
        wb.put("shallow_taw", state.shallowTaw());
        wb.put("deep_taw", state.deepTaw());
        wb.put("shallow_raw", state.shallowRaw());
        wb.put("deep_raw", state.deepRaw());
        wb.put("last_irrigation", state.lastIrrigation());
        wb.put("last_updated", state.lastUpdated() != null ? state.lastUpdated().format(ISO_DATE_TIME) : null);
        wb.put("soil_moist_history", state.soilMoisHistory() != null ? state.soilMoisHistory() : List.of());
        // Lag features (backend tính từ depletion_history + sensor data)
        wb.put("depletion_trend_6h", state.depletionTrend6h() != null ? state.depletionTrend6h() : 0.0f);
        wb.put("depletion_trend_12h", state.depletionTrend12h() != null ? state.depletionTrend12h() : 0.0f);
        wb.put("depletion_trend_24h", state.depletionTrend24h() != null ? state.depletionTrend24h() : 0.0f);
        wb.put("rain_last_6h", state.rainLast6h() != null ? state.rainLast6h() : 0.0f);
        wb.put("rain_last_12h", state.rainLast12h() != null ? state.rainLast12h() : 0.0f);
        wb.put("rain_last_24h", state.rainLast24h() != null ? state.rainLast24h() : 0.0f);
        wb.put("etc_rolling_6h", state.etcRolling6h() != null ? state.etcRolling6h() : 0.0f);
        wb.put("etc_rolling_12h", state.etcRolling12h() != null ? state.etcRolling12h() : 0.0f);
        wb.put("etc_rolling_24h", state.etcRolling24h() != null ? state.etcRolling24h() : 0.0f);
        return wb;
    }

    /**
     * Nếu AI trả về updated_water_balance thì backend persist vào DB (chỉ backend ghi state).
     * Bỏ qua nếu response không có field này (tương thích khi AI chưa trả về).
     */
    @SuppressWarnings("unchecked")
    private void persistUpdatedWaterBalanceFromResponse(Long deviceId, Map<String, Object> pythonResponse) {
        Object updated = pythonResponse.get("updated_water_balance");
        if (updated == null || !(updated instanceof Map)) {
            return;
        }
        Map<String, Object> u = (Map<String, Object>) updated;
        try {
            Float shallowDepletion = parseFloat(u.get("shallow_depletion"));
            Float deepDepletion = parseFloat(u.get("deep_depletion"));
            Float shallowTaw = parseFloat(u.get("shallow_taw"));
            Float deepTaw = parseFloat(u.get("deep_taw"));
            Float shallowRaw = parseFloat(u.get("shallow_raw"));
            Float deepRaw = parseFloat(u.get("deep_raw"));
            Float lastIrr = parseFloat(u.get("last_irrigation"));
            if (shallowDepletion == null || deepDepletion == null || shallowTaw == null || deepTaw == null
                    || shallowRaw == null || deepRaw == null) {
                log.warn("AI updated_water_balance missing required fields, skip persist");
                return;
            }
            List<Map<String, Object>> soilHistory = u.get("soil_moist_history") instanceof List
                    ? (List<Map<String, Object>>) u.get("soil_moist_history")
                    : null;
            waterBalanceStateService.updateState(deviceId, new UpdateWaterBalanceStateRequest(
                    shallowDepletion, deepDepletion, shallowTaw, deepTaw, shallowRaw, deepRaw,
                    lastIrr != null ? lastIrr : 0.0f, null, soilHistory));
            log.info("Persisted updated water balance from AI response for device {}", deviceId);
        } catch (Exception e) {
            log.warn("Failed to persist updated_water_balance from AI: {}", e.getMessage());
        }
    }

    /**
     * Build sensor payload block from SensorData entity.
     */
    private Map<String, Object> buildSensorPayload(SensorData sd) {
        Map<String, Object> sensors = new LinkedHashMap<>();
        sensors.put("temp", sd.getTemperature());
        sensors.put("humidity", sd.getHumidity());
        sensors.put("soil_moist1", sd.getSoilMoisture());
        sensors.put("soil_moist2", sd.getSoilMoisture2());
        sensors.put("rain", Boolean.TRUE.equals(sd.getRainDetected()) ? 1 : 0);
        sensors.put("light", sd.getLightIntensity());
        return sensors;
    }

    /**
     * Build weather payload block from latest WeatherData for device location.
     * Trả null nếu không có weather data.
     */
    private Map<String, Object> buildWeatherPayload(Device device) {
        if (device.getLocation() == null) {
            return null;
        }

        Map<String, Object> weather = new LinkedHashMap<>();

        // 1. Current Weather
        weatherDataRepository
                .findFirstByLocationOrderByForecastTimeDesc(device.getLocation())
                .ifPresent(wd -> {
                    weather.put("temperature", wd.getTemperature());
                    weather.put("humidity", wd.getHumidity());
                    weather.put("wind_speed", wd.getWindSpeed());
                    weather.put("forecast_rain", wd.getPrecipitation());
                    weather.put("precipitation_probability", wd.getPrecipitationProbability());
                    weather.put("uv_index", wd.getUvIndex());
                    weather.put("solar_radiation", wd.getSolarRadiation());
                    weather.put("sunshine_hours", wd.getSunshineHours());
                    weather.put("wind_speed_2m", wd.getWindSpeed2m());
                    weather.put("atmospheric_pressure", wd.getAtmosphericPressure());
                });

        // 2. Daily Forecasts (next 3 days)
        LocalDate today = LocalDate.now();
        List<DailyWeatherForecast> forecasts = dailyWeatherForecastRepository
                .findByLocationAndForecastDateBetween(device.getLocation(), today, today.plusDays(3));

        // Transform to list of maps
        List<Map<String, Object>> forecastList = forecasts.stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", f.getForecastDate().toString());
            m.put("temp_min", f.getTempMin());
            m.put("temp_max", f.getTempMax());
            m.put("temp_avg", f.getTempAvg());
            m.put("humidity_avg", f.getHumidityAvg());
            m.put("wind_speed_avg", f.getWindSpeedAvg());
            m.put("total_rain", f.getTotalRain());
            m.put("precip_prob_avg", f.getPrecipProbAvg());
            m.put("avg_clouds", f.getAvgClouds());
            return m;
        }).toList();

        weather.put("daily_forecasts", forecastList);

        // 3. Rolling Features 24h
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime yesterday = now.minusHours(24);

        // Wind 24h Average (from open weather)
        List<WeatherData> weatherHistory24h = weatherDataRepository
                .findByLocationAndForecastTimeBetween(device.getLocation(), yesterday, now);
        double windSum = 0;
        int windCount = 0;
        for (WeatherData w : weatherHistory24h) {
            if (w.getWindSpeed() != null) {
                windSum += w.getWindSpeed();
                windCount++;
            }
        }
        Double windRolling24h = windCount > 0 ? windSum / windCount
                : (weather.get("wind_speed") != null ? (Double) weather.get("wind_speed") : 2.0);
        weather.put("wind_rolling_24h", windRolling24h);

        // Light 24h & Rain History (from sensors)
        List<SensorData> sensorHistory = sensorDataRepository
                .findByDeviceIdAndTimestampBetween(device.getId(), now.minusDays(7), now); // Get 7 days to find last
                                                                                           // rain

        double lightSum24h = 0;
        Integer hoursSinceLastRain = 72; // Default to 3 days if no rain found

        for (SensorData s : sensorHistory) {
            // Light 24h
            if (s.getTimestamp().isAfter(yesterday)) {
                if (s.getLightIntensity() != null) {
                    lightSum24h += s.getLightIntensity();
                }
            }

            // Check Rain age (looking back up to 7 days)
            if (Boolean.TRUE.equals(s.getRainDetected())) {
                long hoursAgo = ChronoUnit.HOURS.between(s.getTimestamp(), now);
                if (hoursAgo < hoursSinceLastRain) {
                    hoursSinceLastRain = (int) hoursAgo;
                }
            }
        }

        weather.put("light_rolling_24h", lightSum24h);
        weather.put("hours_since_last_rain", hoursSinceLastRain);

        return weather.isEmpty() ? null : weather;
    }

    /**
     * Build crop context payload block from active CropSeason + CropLibrary +
     * SoilLibrary.
     * Bao gồm growth stage tính từ plantAgeDays, Kc hiện tại, root depth, soil
     * info.
     * Trả null nếu device chưa có crop season active.
     */
    private Map<String, Object> buildCropPayload(Device device) {
        return cropSeasonRepository
                .findByDeviceIdAndStatus(device.getId(), CropSeasonStatus.ACTIVE)
                .map(season -> {
                    CropLibrary crop = season.getCrop();
                    SoilLibrary soil = season.getSoil();

                    int plantAgeDays = (int) ChronoUnit.DAYS.between(
                            season.getStartDate(), LocalDate.now());
                    String growthStage = determineGrowthStage(crop, plantAgeDays);
                    double kcCurrent = agroPhysicsService.calculateKc(crop, plantAgeDays);

                    // Effective root depth: linearly interpolate from initial to max
                    int totalDays = crop.getStageIniDays() + crop.getStageDevDays()
                            + crop.getStageMidDays() + crop.getStageEndDays();
                    float rootDepth = season.getInitialRootDepth()
                            + (crop.getMaxRootDepth() - season.getInitialRootDepth())
                                    * Math.min(1.0f, (float) plantAgeDays / totalDays);

                    Map<String, Object> cropPayload = new LinkedHashMap<>();
                    cropPayload.put("type", crop.getName());
                    cropPayload.put("growth_stage", growthStage);
                    cropPayload.put("plant_age_days", plantAgeDays);
                    cropPayload.put("root_depth", rootDepth);
                    cropPayload.put("max_root_depth", crop.getMaxRootDepth());
                    cropPayload.put("kc_current", kcCurrent);
                    cropPayload.put("depletion_fraction", crop.getDepletionFraction());
                    cropPayload.put("soil_type", soil.getName());
                    cropPayload.put("field_capacity", soil.getFieldCapacity());
                    cropPayload.put("wilting_point", soil.getWiltingPoint());

                    // Infiltration ratio với fallback: season override → soil default → hardcoded
                    // default
                    Float infRatio = season.getInfiltrationShallowRatio() != null
                            ? season.getInfiltrationShallowRatio()
                            : (soil.getInfiltrationShallowRatio() != null
                                    ? soil.getInfiltrationShallowRatio()
                                    : 0.70f);
                    cropPayload.put("infiltration_shallow_ratio", infRatio);

                    return cropPayload;
                })
                .orElse(null);
    }

    /**
     * Determine growth stage name from plant age and crop stage durations.
     */
    private String determineGrowthStage(CropLibrary crop, int plantAgeDays) {
        int endIni = crop.getStageIniDays();
        int endDev = endIni + crop.getStageDevDays();
        int endMid = endDev + crop.getStageMidDays();

        if (plantAgeDays <= endIni)
            return "initial";
        if (plantAgeDays <= endDev)
            return "development";
        if (plantAgeDays <= endMid)
            return "mid";
        return "end";
    }

    // ================== HTTP CALL ==================

    /**
     * Gọi Python AI service với error handling thống nhất.
     */
    private Map<String, Object> callPythonService(
            String endpoint, Map<String, Object> payload, String operation, Long deviceId) {

        try {
            String url = aiServiceProperties.getUrl() + endpoint;
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, payload, Map.class);
            log.info("AI {} response for device {}: {}", operation, deviceId, response);

            if (response == null) {
                throw new AppException(
                        "prediction".equals(operation) ? ErrorCode.AI_PREDICTION_FAILED : ErrorCode.AI_TRAINING_FAILED);
            }
            return response;
        } catch (ResourceAccessException e) {
            log.error("AI Python service unavailable: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        } catch (AppException e) {
            throw e; // re-throw our own exceptions
        } catch (Exception e) {
            log.error("AI {} failed: {}", operation, e.getMessage(), e);
            throw new AppException(
                    "prediction".equals(operation) ? ErrorCode.AI_PREDICTION_FAILED : ErrorCode.AI_TRAINING_FAILED);
        }
    }

    // ================== RESPONSE MAPPING ==================

    private MlPredictionDetailResponse toDetailResponse(MlPrediction prediction) {
        Map<String, Object> featuresUsed = parseJson(prediction.getFeaturesUsed());
        Map<String, Object> aiParams = parseJson(prediction.getAnfisParams());

        return new MlPredictionDetailResponse(
                prediction.getId(),
                prediction.getDevice().getId(),
                prediction.getPredictionType(),
                prediction.getPredictedWaterAmount(),
                prediction.getPredictedDuration(),
                prediction.getPredictionHorizon(),
                prediction.getModelAccuracy(),
                featuresUsed,
                prediction.getAnfisOutput(),
                aiParams,
                prediction.getAnfisAccuracy(),
                prediction.getCreatedAt());
    }

    // ================== HELPER METHODS ==================

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse JSON: {}", e.getMessage());
            return null;
        }
    }

    private Float parseFloat(Object value) {
        if (value == null)
            return null;
        if (value instanceof Number)
            return ((Number) value).floatValue();
        try {
            return Float.parseFloat(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInteger(Object value) {
        if (value == null)
            return null;
        if (value instanceof Number)
            return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
