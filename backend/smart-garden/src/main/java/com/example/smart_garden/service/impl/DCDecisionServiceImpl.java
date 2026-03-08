package com.example.smart_garden.service.impl;

import com.example.smart_garden.entity.*;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.DailyWaterBalanceRepository;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.DCDecisionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Implementation of DCDecisionService — Hybrid Decision Making.
 *
 * Decision flow:
 * 1. Get latest DC value from daily_water_balance (physics model)
 * 2. Get latest soil moisture from sensor_data (real-time IoT)
 * 3. Calculate TAW and threshold from crop/soil profiles
 * 4. If both DC and sensor indicate stress → IRRIGATE
 * 5. If conflict → Call Python Random Forest model for final decision
 * 6. Generate irrigation command
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DCDecisionServiceImpl implements DCDecisionService {

    private final DeviceRepository deviceRepository;
    private final CropSeasonRepository cropSeasonRepository;
    private final DailyWaterBalanceRepository dailyWaterBalanceRepository;
    private final SensorDataRepository sensorDataRepository;
    private final AgroPhysicsService agroPhysicsService;

    @Value("${ml.service.url:http://localhost:5000}")
    private String mlServiceUrl;

    @Value("${ml.service.prediction-endpoint:/predict}")
    private String mlPredictionEndpoint;

    @Override
    @Transactional(readOnly = true)
    public DCDecisionResult makeDecision(Long deviceId) {
        log.info("Making hybrid irrigation decision for device #{}", deviceId);

        // 1. Get device
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // 2. Get active crop season
        CropSeason season = cropSeasonRepository.findByDeviceIdAndStatus(deviceId, CropSeasonStatus.ACTIVE)
                .orElseThrow(() -> new AppException(ErrorCode.NO_ACTIVE_SEASON));

        CropLibrary crop = season.getCrop();
        SoilLibrary soil = season.getSoil();

        // 3. Get latest DC from water balance
        double dcValue = 0.0;
        Optional<DailyWaterBalance> latestBalance = dailyWaterBalanceRepository
                .findTopByCropSeasonIdOrderByDateDesc(season.getId());
        if (latestBalance.isPresent() && latestBalance.get().getDcValue() != null) {
            dcValue = latestBalance.get().getDcValue();
        }

        // 4. Get sensor soil moisture — aggregated AVG 30min to reduce noise
        double sensorMoisture = 50.0; // default
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now.minusMinutes(30);
        List<Object[]> aggRows = sensorDataRepository
                .findAggregatedSensorByDeviceIdAndTimeRange(deviceId, windowStart, now);
        if (!aggRows.isEmpty() && aggRows.get(0) != null) {
            Object avgSoil = aggRows.get(0)[3]; // avg_soil1
            if (avgSoil instanceof Number) {
                sensorMoisture = ((Number) avgSoil).doubleValue();
            }
        } else {
            // Fallback: bản ghi gần nhất
            Optional<SensorData> latestSensor = sensorDataRepository
                    .findFirstByDeviceIdOrderByTimestampDesc(deviceId);
            if (latestSensor.isPresent() && latestSensor.get().getSoilMoisture() != null) {
                sensorMoisture = latestSensor.get().getSoilMoisture();
            }
        }

        // 5. Calculate thresholds
        double rootDepth = season.getInitialRootDepth() != null ? season.getInitialRootDepth() : crop.getMaxRootDepth();
        double taw = agroPhysicsService.calculateTAW(
                soil.getFieldCapacity(), soil.getWiltingPoint(), rootDepth);
        double depletionFraction = crop.getDepletionFraction() != null ? crop.getDepletionFraction() : 0.5;
        double allowableDepletion = taw * depletionFraction;

        // 6. Physics-based assessment
        boolean physicsSaysIrrigate = dcValue > allowableDepletion;
        // Sensor-based assessment (if moisture < wilting_point + buffer → dry)
        double dryThreshold = soil.getWiltingPoint() + (soil.getFieldCapacity() - soil.getWiltingPoint()) * 0.4;
        boolean sensorSaysDry = sensorMoisture < dryThreshold;

        log.info("Decision inputs: DC={:.2f}mm (threshold={:.2f}), sensor={:.1f}% (threshold={:.1f}%)",
                dcValue, allowableDepletion, sensorMoisture, dryThreshold);

        // 7. Decision logic
        boolean shouldIrrigate;
        double recommendedAmount = 0.0;
        String mlResult = "NOT_CALLED";
        String recommendation;

        if (physicsSaysIrrigate && sensorSaysDry) {
            // Both agree — irrigate
            shouldIrrigate = true;
            recommendedAmount = dcValue - allowableDepletion * 0.3;
            recommendation = "CONSENSUS_IRRIGATE — Both physics model and sensor indicate water deficit";
        } else if (!physicsSaysIrrigate && !sensorSaysDry) {
            // Both agree — no irrigation
            shouldIrrigate = false;
            recommendation = "CONSENSUS_NO_IRRIGATION — Both physics model and sensor indicate adequate moisture";
        } else {
            // Conflict — call ML model for arbitration
            mlResult = callPythonMLModel(deviceId, dcValue, sensorMoisture,
                    latestBalance.map(DailyWaterBalance::getCropAge).orElse(0));

            shouldIrrigate = "IRRIGATE".equalsIgnoreCase(mlResult);
            if (shouldIrrigate) {
                recommendedAmount = dcValue * 0.5;
            }
            recommendation = String.format("ML_ARBITRATION — Physics(%s) vs Sensor(%s) conflict → ML says: %s",
                    physicsSaysIrrigate ? "DRY" : "OK",
                    sensorSaysDry ? "DRY" : "OK",
                    mlResult);
        }

        log.info("Decision for device #{}: shouldIrrigate={}, amount={:.1f}mm, reason='{}'",
                deviceId, shouldIrrigate, recommendedAmount, recommendation);

        return new DCDecisionResult(
                shouldIrrigate,
                recommendedAmount,
                dcValue,
                sensorMoisture,
                mlResult,
                recommendation);
    }

    /**
     * Call the Python Random Forest model for conflict arbitration.
     * Sends DC + sensor moisture + plant age as features.
     */
    private String callPythonMLModel(Long deviceId, double dcValue, double sensorMoisture, int plantAge) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = mlServiceUrl + mlPredictionEndpoint;

            Map<String, Object> request = new HashMap<>();
            request.put("device_id", deviceId);
            request.put("dc_value", dcValue);
            request.put("soil_moisture", sensorMoisture);
            request.put("plant_age", plantAge);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getBody() != null && response.getBody().containsKey("prediction")) {
                return response.getBody().get("prediction").toString();
            }

            return "UNKNOWN";

        } catch (Exception e) {
            log.warn("Failed to call ML model for device #{}. Falling back to physics-based decision: {}",
                    deviceId, e.getMessage());
            // Fallback: if ML fails, trust the physics model
            return dcValue > 0 ? "IRRIGATE" : "NO_IRRIGATION";
        }
    }
}
