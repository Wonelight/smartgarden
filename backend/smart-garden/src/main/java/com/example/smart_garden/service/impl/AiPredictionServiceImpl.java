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
import com.example.smart_garden.repository.SensorDataHourlyRepository;
import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;
import com.example.smart_garden.event.SystemLogPublisher;
import com.example.smart_garden.entity.enums.LogSource;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.AiPredictionService;
import com.example.smart_garden.service.WaterBalanceStateService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
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
    private final SensorDataHourlyRepository sensorDataHourlyRepository;
    private final AgroPhysicsService agroPhysicsService;
    private final WaterBalanceStateService waterBalanceStateService;
    private final ObjectMapper objectMapper;
    private final com.example.smart_garden.mqtt.MqttCommandSender mqttCommandSender;
    private final SystemLogPublisher sysLog;
    private final com.example.smart_garden.repository.UserRepository userRepository;

    /** Dev flag: bỏ qua Decision Window để test ngoài giờ tưới (set false trước deploy). */
    @Value("${app.dev.bypass-time-gate:false}")
    private boolean devBypassTimeGate;

    private static final DateTimeFormatter ISO_DATE_TIME = DateTimeFormatter.ISO_DATE_TIME;

    /** Khoảng thời gian lấy AVG sensor data cho AI (phút). */
    private static final int SENSOR_AGGREGATION_WINDOW_MINUTES = 30;

    // ================== PREDICT ==================

    @Override
    @Transactional
    public AiPredictResponse predict(AiPredictRequest request) {
        // 1. Validate device
        Device device = deviceRepository.findById(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // 1a. Ownership check — chỉ áp dụng cho REST calls (có auth context).
        //     Batch job / scheduler chạy không có user → bỏ qua.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticatedUser = auth != null
                && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal());
        if (isAuthenticatedUser) {
            com.example.smart_garden.entity.User caller = userRepository
                    .findByUsername(auth.getName())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            if (device.getUser() == null || !device.getUser().getId().equals(caller.getId())) {
                throw new AppException(ErrorCode.ACCESS_DENIED, "Device does not belong to you");
            }
        }

        // 2. Check AI enabled
        IrrigationConfig config = irrigationConfigRepository.findByDeviceId(request.deviceId())
                .orElse(null);
        if (config == null || !Boolean.TRUE.equals(config.getAiEnabled())) {
            throw new AppException(ErrorCode.AI_SERVICE_NOT_ENABLED);
        }

        // 3. Build sensor payload — aggregated (preferred) or single record
        Map<String, Object> sensorPayload;
        if (request.sensorDataId() != null) {
            // Backward-compat: dùng bản ghi cụ thể nếu truyền vào
            SensorData sensorData = sensorDataRepository.findById(request.sensorDataId())
                    .orElseThrow(() -> new AppException(ErrorCode.SENSOR_NOT_FOUND));
            sensorPayload = buildSensorPayload(sensorData);
        } else {
            // Preferred: tổng hợp AVG 30 phút gần nhất để lọc nhiễu
            sensorPayload = buildAggregatedSensorPayload(request.deviceId());
        }

        // 4. Build rich payload
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("device_id", request.deviceId());
        payload.put("sensors", sensorPayload);
        payload.put("openweather", buildWeatherPayload(device));

        Map<String, Object> cropPayload = buildCropPayload(device);
        if (cropPayload == null) {
            log.warn("Device {} has no active CropSeason. Cannot perform AI prediction.", request.deviceId());
            throw new AppException(ErrorCode.NO_ACTIVE_SEASON);
        }
        payload.put("crop", cropPayload);
        // Single source of truth: state từ DB, gửi kèm để AI không cần GET/PUT
        payload.put("water_balance", buildWaterBalancePayload(waterBalanceStateService.getState(request.deviceId())));

        // Pump config: AI service dùng để tính flow_rate_mm_per_sec = (pumpFlowRate × nozzleCount / 60) / gardenArea
        IrrigationConfig irrigConfig = irrigationConfigRepository.findByDeviceId(request.deviceId()).orElse(null);
        Map<String, Object> pumpPayload = new LinkedHashMap<>();
        pumpPayload.put("pump_flow_rate_lpm", irrigConfig != null && irrigConfig.getPumpFlowRate() != null ? irrigConfig.getPumpFlowRate() : 0.5f);
        pumpPayload.put("nozzle_count", irrigConfig != null && irrigConfig.getNozzleCount() != null ? irrigConfig.getNozzleCount() : 1);
        pumpPayload.put("garden_area_m2", device.getGardenArea() != null ? device.getGardenArea() : 1.0);
        payload.put("pump", pumpPayload);

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
                .predictedWaterAmount(aiOutput)
                .aiOutput(aiOutput)
                .aiAccuracy(parseFloat(pythonResponse.get("accuracy")))
                .build();

        // Save AI params as JSON if present
        Object paramsObj = pythonResponse.get("ai_params");
        if (paramsObj != null) {
            try {
                prediction.setAiParams(objectMapper.writeValueAsString(paramsObj));
                if (paramsObj instanceof Map) {
                    Map<?, ?> paramsMap = (Map<?, ?>) paramsObj;
                    if (paramsMap.containsKey("features")) {
                        Object features = paramsMap.get("features");
                        prediction.setFeaturesUsed(objectMapper.writeValueAsString(features));

                        // Extract specific variables if needed
                        if (features instanceof Map) {
                            Map<?, ?> fMap = (Map<?, ?>) features;
                            if (fMap.containsKey("etc"))
                                prediction.setEtc(parseFloat(fMap.get("etc")));
                            if (fMap.containsKey("raw"))
                                prediction.setRaw(parseFloat(fMap.get("raw")));
                            if (fMap.containsKey("soil_moist_deep"))
                                prediction.setSoilMoistDeep(parseFloat(fMap.get("soil_moist_deep")));
                            if (fMap.containsKey("soil_moist_shallow"))
                                prediction.setSoilMoistShallow(parseFloat(fMap.get("soil_moist_shallow")));
                            if (fMap.containsKey("predicted_depl_24h"))
                                prediction.setPredictedDepl24h(parseFloat(fMap.get("predicted_depl_24h")));
                            if (fMap.containsKey("soil_moist_deficit"))
                                prediction.setSoilMoistDeficit(parseFloat(fMap.get("soil_moist_deficit")));
                            if (fMap.containsKey("soil_moist_trend_1h"))
                                prediction.setSoilMoistTrend1h(parseFloat(fMap.get("soil_moist_trend_1h")));
                            if (fMap.containsKey("water_mm"))
                                prediction.setWaterMm(parseFloat(fMap.get("water_mm")));
                        }
                    }
                }
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize AI params: {}", e.getMessage());
            }
        }

        prediction = mlPredictionRepository.save(prediction);
        log.info("Saved AI prediction {} for device {}", prediction.getId(), request.deviceId());

        // 7. Persist updated water balance from AI (single source of truth: chỉ backend
        // ghi DB)
        persistUpdatedWaterBalanceFromResponse(request.deviceId(), pythonResponse);

        // 7.5 Plan A: Gửi lệnh IRRIGATE tới ESP32 nếu predictedDuration > 0
        //     Chỉ gửi trong Decision Window (5-7h, 17-19h) và khi sensor cho phép
        dispatchIrrigationCommand(device, predictedDuration, sensorPayload);

        // 8. Update FuzzyLogicResult if exists
        FuzzyLogicResult latestFuzzy = fuzzyLogicResultRepository
                .findFirstByDeviceIdOrderByTimestampDesc(request.deviceId())
                .orElse(null);
        if (latestFuzzy != null && refinedDuration != null) {
            latestFuzzy.setAiRefinedDuration(refinedDuration);
            latestFuzzy.setAiConfidence(confidence);
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
                .aiAccuracy(accuracy)
                .modelAccuracy(accuracy)
                .build();

        Object paramsObj = pythonResponse.get("trained_params");
        Map<String, Object> paramsMap = null;
        if (paramsObj != null) {
            try {
                String paramsJson = objectMapper.writeValueAsString(paramsObj);
                prediction.setAiParams(paramsJson);
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

    // ================== GET HISTORY ==================

    @Override
    @Transactional(readOnly = true)
    public List<MlPredictionDetailResponse> getPredictionHistory(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        // Fix limit to 50 using PageRequest
        org.springframework.data.domain.Pageable top50 = org.springframework.data.domain.PageRequest.of(0, 50);
        org.springframework.data.domain.Page<MlPrediction> page = mlPredictionRepository
                .findByDeviceIdOrderByCreatedAtDesc(deviceId, top50);

        return page.getContent().stream()
                .map(this::toDetailResponse)
                .toList();
    }

    // ================== PAYLOAD BUILDERS ==================

    /**
     * Plan A: Gửi lệnh IRRIGATE tới ESP32 sau khi AI prediction hoàn tất.
     * Áp dụng 3 lớp gate trước khi gửi:
     *   1. predictedDuration > 0 (AI xác nhận cần tưới)
     *   2. Decision Window: chỉ tưới 5-7h sáng hoặc 17-19h chiều
     *   3. Sensor gate: soil > 65% hoặc đang mưa → bỏ qua
     */
    private void dispatchIrrigationCommand(Device device, Integer predictedDuration,
                                           Map<String, Object> sensorPayload) {
        if (predictedDuration == null || predictedDuration <= 0) {
            log.info("[IRRIGATE] Skip device={}: AI duration={} (no irrigation needed)",
                    device.getDeviceCode(), predictedDuration);
            return;
        }

        // --- Gate 1: Decision Window (5-7h sáng hoặc 17-19h chiều) ---
        int currentHour = java.time.LocalTime.now().getHour();
        boolean inMorningWindow  = currentHour >= 5  && currentHour <= 7;
        boolean inEveningWindow  = currentHour >= 17 && currentHour <= 19;
        if (!devBypassTimeGate && !inMorningWindow && !inEveningWindow) {
            log.info("[IRRIGATE] Skip device={}: hour={} outside Decision Window (5-7h or 17-19h)",
                    device.getDeviceCode(), currentHour);
            return;
        }
        if (devBypassTimeGate && !inMorningWindow && !inEveningWindow) {
            log.warn("[IRRIGATE][DEV] Bypassing time gate for device={} at hour={}",
                    device.getDeviceCode(), currentHour);
        }

        // --- Gate 2: Sensor-based conditions ---
        if (sensorPayload != null) {
            // Soil moisture: trung bình 2 sensor
            Double soil1 = toDouble(sensorPayload.get("soil_moist1"));
            Double soil2 = toDouble(sensorPayload.get("soil_moist2"));
            if (soil1 != null && soil2 != null) {
                double avgSoil = (soil1 + soil2) / 2.0;
                if (avgSoil >= 65.0) {
                    log.info("[IRRIGATE] Skip device={}: soil={}% >= 65%% threshold",
                            device.getDeviceCode(), String.format("%.1f", avgSoil));
                    return;
                }
            }
            // Rain check
            Object rain = sensorPayload.get("rain");
            if (rain != null) {
                int rainVal = rain instanceof Number ? ((Number) rain).intValue() : 0;
                if (rainVal > 0) {
                    log.info("[IRRIGATE] Skip device={}: rain detected", device.getDeviceCode());
                    return;
                }
            }
        }

        // Safety: cap at 10 phút/lần (600s) để tránh tưới quá nhiều một đợt
        int safeDuration = Math.min(predictedDuration, 600);

        log.info("[IRRIGATE] Dispatching to device={} duration={}s (hour={})",
                device.getDeviceCode(), safeDuration, currentHour);
        sysLog.info(LogSource.BACKEND, device.getId(),
                "[IRRIGATE] Gửi lệnh tưới tới " + device.getDeviceCode() + " – " + safeDuration + "s");

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                boolean ackOk = mqttCommandSender.sendAndWaitAck(
                        device.getDeviceCode(), "IRRIGATE", null, safeDuration);
                if (ackOk) {
                    log.info("[IRRIGATE] ACK received device={} duration={}s",
                            device.getDeviceCode(), safeDuration);
                    sysLog.info(LogSource.ESP32, device.getId(),
                            "[IRRIGATE] ACK nhận từ " + device.getDeviceCode() + " – " + safeDuration + "s");
                } else {
                    log.warn("[IRRIGATE] ACK timeout device={} duration={}s (ESP32 offline or no response)",
                            device.getDeviceCode(), safeDuration);
                    sysLog.warn(LogSource.BACKEND, device.getId(),
                            "[IRRIGATE] Timeout ACK từ " + device.getDeviceCode() + " (ESP32 offline – " + safeDuration + "s)");
                }
            } catch (Exception e) {
                log.error("[IRRIGATE] Failed to send command device={}: {}",
                        device.getDeviceCode(), e.getMessage());
                sysLog.error(LogSource.BACKEND, device.getId(),
                        "[IRRIGATE] Lỗi gửi lệnh tới " + device.getDeviceCode() + ": " + e.getMessage());
            }
        });
    }

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
     * Nếu AI trả về updated_water_balance thì backend persist vào DB (chỉ backend
     * ghi state).
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
     * Build sensor payload block from a single SensorData entity (backward-compat).
     */
    private Map<String, Object> buildSensorPayload(SensorData sd) {
        Map<String, Object> sensors = new LinkedHashMap<>();
        sensors.put("temp", sd.getTemperature());
        sensors.put("humidity", sd.getHumidity());
        sensors.put("soil_moist1", sd.getSoilMoisture());
        sensors.put("soil_moist2", sd.getSoilMoisture2());
        sensors.put("rain", Boolean.TRUE.equals(sd.getRainDetected()) ? 1 : 0);
        sensors.put("light", sd.getLightIntensity());
        sensors.put("source", "single_record");
        sensors.put("sample_count", 1);
        return sensors;
    }

    /**
     * Build sensor payload block từ dữ liệu tổng hợp (AVG) của N phút gần nhất.
     * Lọc nhiễu phần cứng hiệu quả: thay vì bốc 1 bản ghi ngẫu nhiên
     * có thể bị spike/noise, lấy trung bình cộng của toàn bộ readings
     * trong cửa sổ thời gian → giá trị đại diện chính xác hơn.
     *
     * Fallback: nếu không có dữ liệu trong cửa sổ, lấy bản ghi gần nhất.
     */
    private Map<String, Object> buildAggregatedSensorPayload(Long deviceId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now.minusMinutes(SENSOR_AGGREGATION_WINDOW_MINUTES);

        List<Object[]> rows = sensorDataRepository
                .findAggregatedSensorByDeviceIdAndTimeRange(deviceId, windowStart, now);

        if (rows.isEmpty() || rows.get(0) == null) {
            // Fallback: lấy bản ghi cuối cùng (single record)
            return fallbackToLatestSensor(deviceId);
        }

        Object[] row = rows.get(0);
        int sampleCount = toInt(row[0]);

        if (sampleCount == 0) {
            // Cửa sổ trống, fallback
            return fallbackToLatestSensor(deviceId);
        }

        Map<String, Object> sensors = new LinkedHashMap<>();
        sensors.put("temp", toDouble(row[1])); // avg_temp
        sensors.put("humidity", toDouble(row[2])); // avg_humidity
        sensors.put("soil_moist1", toDouble(row[3])); // avg_soil1
        sensors.put("soil_moist2", toDouble(row[4])); // avg_soil2
        sensors.put("light", toDouble(row[5])); // avg_light
        sensors.put("rain", toInt(row[6]) > 0 ? 1 : 0); // rain_detected_count > 0
        sensors.put("source", "aggregated_" + SENSOR_AGGREGATION_WINDOW_MINUTES + "min");
        sensors.put("sample_count", sampleCount);
        // Cung cấp thêm MIN/MAX để AI biết biên độ dao động
        sensors.put("temp_min", toDouble(row[7]));
        sensors.put("temp_max", toDouble(row[8]));
        sensors.put("humidity_min", toDouble(row[9]));
        sensors.put("humidity_max", toDouble(row[10]));
        sensors.put("soil_moist1_min", toDouble(row[11]));
        sensors.put("soil_moist1_max", toDouble(row[12]));

        log.info("Built aggregated sensor payload for device {} — {} samples in {}min window",
                deviceId, sampleCount, SENSOR_AGGREGATION_WINDOW_MINUTES);
        return sensors;
    }

    /**
     * Fallback: lấy bản ghi sensor gần nhất khi cửa sổ tổng hợp trống.
     */
    private Map<String, Object> fallbackToLatestSensor(Long deviceId) {
        SensorData latest = sensorDataRepository.findFirstByDeviceIdOrderByTimestampDesc(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.SENSOR_NOT_FOUND));
        log.warn("No aggregated data in {}min window for device {}, falling back to latest record",
                SENSOR_AGGREGATION_WINDOW_MINUTES, deviceId);
        Map<String, Object> sensors = buildSensorPayload(latest);
        sensors.put("source", "fallback_latest");
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

        // Light 24h & Rain History — dùng sensor_data_hourly (Job 3) để tối ưu.
        // Thay thế 7-day raw scan (2000+ records) bằng 168 hourly records.
        LocalDateTime lightWindowStart = now.minusHours(24);
        LocalDateTime rainWindowStart  = now.minusDays(7);

        List<SensorDataHourly> hourlyHistory = sensorDataHourlyRepository
                .findByDeviceIdAndHourStartBetweenOrderByHourStartDesc(
                        device.getId(), rainWindowStart, now);

        double lightSum24h = 0;
        int hoursSinceLastRain = 72; // Default: 3 ngày nếu không có mưa

        for (SensorDataHourly h : hourlyHistory) {
            // Light: cộng dồn avgLightIntensity trong 24h gần nhất
            if (h.getHourStart().isAfter(lightWindowStart) && h.getAvgLightIntensity() != null) {
                lightSum24h += h.getAvgLightIntensity();
            }
            // Rain: tìm giờ mưa gần nhất trong 7 ngày qua
            if (h.getRainDetectedCount() != null && h.getRainDetectedCount() > 0) {
                int hoursAgo = (int) ChronoUnit.HOURS.between(h.getHourStart(), now);
                if (hoursAgo < hoursSinceLastRain) {
                    hoursSinceLastRain = hoursAgo;
                }
            }
        }

        // Bridge: Job 3 lag ~1h (chỉ aggregate giờ trước), kiểm tra thêm raw 2h gần nhất
        // để không bỏ sót mưa trong giờ hiện tại chưa được aggregate.
        List<SensorData> recentRaw = sensorDataRepository
                .findByDeviceIdAndTimestampBetween(device.getId(), now.minusHours(2), now);
        for (SensorData s : recentRaw) {
            if (Boolean.TRUE.equals(s.getRainDetected())) {
                int hoursAgo = (int) ChronoUnit.HOURS.between(s.getTimestamp(), now);
                if (hoursAgo < hoursSinceLastRain) {
                    hoursSinceLastRain = hoursAgo;
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

            try {
                log.info("====== AI {} REQUEST PAYLOAD [{}] ======\n{}", operation.toUpperCase(), deviceId,
                        objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            } catch (Exception e) {
                log.info("====== AI {} REQUEST PAYLOAD [{}] ======\n{}", operation.toUpperCase(), deviceId, payload);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, payload, Map.class);

            try {
                log.info("====== AI {} RESPONSE [{}] ======\n{}", operation.toUpperCase(), deviceId,
                        objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(response));
            } catch (Exception e) {
                log.info("====== AI {} RESPONSE [{}] ======\n{}", operation.toUpperCase(), deviceId, response);
            }

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
        Map<String, Object> aiParams = parseJson(prediction.getAiParams());
        return new MlPredictionDetailResponse(
                prediction.getId(),
                prediction.getDevice().getId(),
                prediction.getPredictionType(),
                prediction.getPredictedWaterAmount() != null ? prediction.getPredictedWaterAmount()
                        : prediction.getAiOutput(),
                prediction.getPredictedDuration(),
                prediction.getPredictionHorizon(),
                prediction.getModelAccuracy(),
                featuresUsed,
                prediction.getAiOutput(),
                aiParams,
                prediction.getAiAccuracy(),
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

    /**
     * Helper: convert native query result (BigDecimal/Number) to Double.
     * MySQL JSON_EXTRACT + AVG trả về BigDecimal.
     */
    private Double toDouble(Object value) {
        if (value == null)
            return null;
        if (value instanceof BigDecimal)
            return ((BigDecimal) value).doubleValue();
        if (value instanceof Number)
            return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Helper: convert native query result to int (default 0).
     */
    private int toInt(Object value) {
        if (value == null)
            return 0;
        if (value instanceof Number)
            return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
