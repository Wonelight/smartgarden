package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.DeviceWaterBalanceState;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.DeviceWaterBalanceStateRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.service.WaterBalanceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Implementation của WaterBalanceStateService.
 * Quản lý persistent storage cho water balance state trong MySQL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WaterBalanceStateServiceImpl implements WaterBalanceStateService {

    private final DeviceWaterBalanceStateRepository stateRepository;
    private final DeviceRepository deviceRepository;
    private final SensorDataRepository sensorDataRepository;
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_DATE_TIME;
    private static final int TREND_WINDOW = 6; // ~1h nếu mỗi 10 phút đọc 1 lần
    private static final int LAG_HOURS_24 = 24;

    @Override
    @Transactional
    public WaterBalanceStateResponse getState(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        DeviceWaterBalanceState state = stateRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    log.info("Creating new water balance state for device {}", deviceId);
                    return createDefaultState(device);
                });

        return mapToResponse(state);
    }

    @Override
    @Transactional
    public WaterBalanceStateResponse updateState(Long deviceId, UpdateWaterBalanceStateRequest request) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        DeviceWaterBalanceState state = stateRepository.findByDeviceId(deviceId)
                .orElseGet(() -> createDefaultState(device));

        // Update shallow layer
        state.setShallowDepletion(Math.max(0.0f, Math.min(request.shallowDepletion(), state.getShallowTaw())));
        state.setShallowTaw(request.shallowTaw());
        state.setShallowRaw(request.shallowRaw());

        // Update deep layer
        state.setDeepDepletion(Math.max(0.0f, Math.min(request.deepDepletion(), state.getDeepTaw())));
        state.setDeepTaw(request.deepTaw());
        state.setDeepRaw(request.deepRaw());

        // Update irrigation
        if (request.lastIrrigation() != null) {
            state.setLastIrrigation(request.lastIrrigation());
        }

        // Update soil moisture history
        if (request.soilMoisHistory() != null && !request.soilMoisHistory().isEmpty()) {
            // Limit to TREND_WINDOW size
            List<Map<String, Object>> history = new ArrayList<>(request.soilMoisHistory());
            if (history.size() > TREND_WINDOW) {
                history = history.subList(history.size() - TREND_WINDOW, history.size());
            }
            state.setSoilMoisHistory(history);
        } else if (request.soilMoisAvg() != null) {
            // Add new entry if soil_moist_avg provided
            List<Map<String, Object>> history = state.getSoilMoisHistory() != null
                    ? new ArrayList<>(state.getSoilMoisHistory())
                    : new ArrayList<>();

            Map<String, Object> entry = new HashMap<>();
            entry.put("timestamp", LocalDateTime.now().format(ISO_FORMATTER));
            entry.put("value", request.soilMoisAvg());
            history.add(entry);

            // Limit to TREND_WINDOW
            if (history.size() > TREND_WINDOW) {
                history = history.subList(history.size() - TREND_WINDOW, history.size());
            }
            state.setSoilMoisHistory(history);
        }

        // Append current weighted depletion to history (để tính lag 6h/12h/24h)
        float weighted = state.getWeightedDepletion();
        List<Map<String, Object>> deplHist = state.getDepletionHistory() != null
                ? new ArrayList<>(state.getDepletionHistory())
                : new ArrayList<>();
        Map<String, Object> deplEntry = new HashMap<>();
        deplEntry.put("timestamp", LocalDateTime.now().format(ISO_FORMATTER));
        deplEntry.put("value", weighted);
        deplHist.add(deplEntry);
        // Giữ tối đa 24h (ví dụ 144 điểm nếu 10 phút/lần)
        LocalDateTime cutoff = LocalDateTime.now().minusHours(LAG_HOURS_24);
        deplHist = deplHist.stream()
                .filter(e -> parseTimestamp((String) e.get("timestamp")).isAfter(cutoff))
                .collect(Collectors.toList());
        state.setDepletionHistory(deplHist);

        // Append ETc value vào etcHistory (để tính etc_rolling 6h/12h/24h)
        if (request.etcValue() != null && request.etcValue() > 0) {
            List<Map<String, Object>> etcHist = state.getEtcHistory() != null
                    ? new ArrayList<>(state.getEtcHistory())
                    : new ArrayList<>();
            Map<String, Object> etcEntry = new HashMap<>();
            etcEntry.put("timestamp", LocalDateTime.now().format(ISO_FORMATTER));
            etcEntry.put("value", request.etcValue());
            etcHist.add(etcEntry);
            etcHist = etcHist.stream()
                    .filter(e -> parseTimestamp((String) e.get("timestamp")).isAfter(cutoff))
                    .collect(Collectors.toList());
            state.setEtcHistory(etcHist);
        }

        state = stateRepository.save(state);
        log.debug("Updated water balance state for device {}: shallow_depl={}, deep_depl={}, weighted={}",
                deviceId, state.getShallowDepletion(), state.getDeepDepletion(), state.getWeightedDepletion());

        return mapToResponse(state);
    }

    @Override
    public Float calculateSoilMoisTrend(List<Map<String, Object>> history) {
        if (history == null || history.size() < 2) {
            return 0.0f;
        }

        try {
            Map<String, Object> oldest = history.get(0);
            Map<String, Object> newest = history.get(history.size() - 1);

            String oldestTimeStr = (String) oldest.get("timestamp");
            String newestTimeStr = (String) newest.get("timestamp");
            Double oldestVal = getDoubleValue(oldest.get("value"));
            Double newestVal = getDoubleValue(newest.get("value"));

            if (oldestTimeStr == null || newestTimeStr == null || oldestVal == null || newestVal == null) {
                return 0.0f;
            }

            LocalDateTime oldestTime = LocalDateTime.parse(oldestTimeStr, ISO_FORMATTER);
            LocalDateTime newestTime = LocalDateTime.parse(newestTimeStr, ISO_FORMATTER);

            long seconds = java.time.Duration.between(oldestTime, newestTime).getSeconds();
            double elapsedHours = seconds / 3600.0;

            if (elapsedHours < 0.01) { // < 36 seconds
                return 0.0f;
            }

            return (float) ((newestVal - oldestVal) / elapsedHours);
        } catch (Exception e) {
            log.warn("Error calculating soil moisture trend: {}", e.getMessage());
            return 0.0f;
        }
    }

    private DeviceWaterBalanceState createDefaultState(Device device) {
        // Giá trị mặc định dựa trên loam soil (FC=30%, WP=15%, root=0.3m, p=0.5)
        // TAW = 1000 × (0.30 - 0.15) × 0.3 = 45 mm total
        // Shallow (40%): TAW=18mm, RAW=9mm | Deep (60%): TAW=27mm, RAW=13.5mm
        float shallowTaw = 18.0f;
        float deepTaw = 27.0f;
        float shallowRaw = 9.0f;
        float deepRaw = 13.5f;

        DeviceWaterBalanceState state = DeviceWaterBalanceState.builder()
                .device(device)
                .shallowDepletion(0.0f)
                .shallowTaw(shallowTaw)
                .shallowRaw(shallowRaw)
                .deepDepletion(0.0f)
                .deepTaw(deepTaw)
                .deepRaw(deepRaw)
                .lastIrrigation(0.0f)
                .soilMoisHistory(new ArrayList<>())
                .depletionHistory(new ArrayList<>())
                .etcHistory(new ArrayList<>())
                .build();
        log.info("Created default water balance state for device {} (loam defaults: TAW={}/{}, RAW={}/{})",
                device.getId(), shallowTaw, deepTaw, shallowRaw, deepRaw);
        return stateRepository.save(state);
    }

    private WaterBalanceStateResponse mapToResponse(DeviceWaterBalanceState state) {
        Float trend = calculateSoilMoisTrend(state.getSoilMoisHistory());
        Long deviceId = state.getDevice().getId();
        float depletionTrend6h = calculateDepletionTrend(state.getDepletionHistory(), 6);
        float depletionTrend12h = calculateDepletionTrend(state.getDepletionHistory(), 12);
        float depletionTrend24h = calculateDepletionTrend(state.getDepletionHistory(), 24);
        float rainLast6h = sumRainInWindow(deviceId, 6);
        float rainLast12h = sumRainInWindow(deviceId, 12);
        float rainLast24h = sumRainInWindow(deviceId, 24);
        return new WaterBalanceStateResponse(
                deviceId,
                state.getShallowDepletion(),
                state.getDeepDepletion(),
                state.getShallowTaw(),
                state.getDeepTaw(),
                state.getShallowRaw(),
                state.getDeepRaw(),
                state.getWeightedDepletion(),
                state.getTotalTaw(),
                state.getTotalRaw(),
                state.getLastIrrigation(),
                state.getSoilMoisHistory(),
                trend,
                state.getUpdatedAt(),
                depletionTrend6h,
                depletionTrend12h,
                depletionTrend24h,
                rainLast6h,
                rainLast12h,
                rainLast24h,
                sumEtcInWindow(state.getEtcHistory(), 6),
                sumEtcInWindow(state.getEtcHistory(), 12),
                sumEtcInWindow(state.getEtcHistory(), 24)
        );
    }

    /** Trend = giá trị cuối - giá trị đầu trong window (giống AI _lag_trend). */
    private float calculateDepletionTrend(List<Map<String, Object>> history, int hours) {
        if (history == null || history.size() < 2) {
            return 0.0f;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusHours(hours);
        List<Map<String, Object>> inWindow = history.stream()
                .filter(e -> parseTimestamp((String) e.get("timestamp")).isAfter(cutoff))
                .collect(Collectors.toList());
        if (inWindow.size() < 2) {
            inWindow = new ArrayList<>(history);
        }
        if (inWindow.size() < 2) {
            return 0.0f;
        }
        Double first = getDoubleValue(inWindow.get(0).get("value"));
        Double last = getDoubleValue(inWindow.get(inWindow.size() - 1).get("value"));
        if (first == null || last == null) {
            return 0.0f;
        }
        return (float) (last - first);
    }

    /**
     * Hệ thống không có rain gauge — sensor rainDetected là binary 0/1 không đo được mm.
     * Rain (mm) được tính từ OpenWeather trong AiPredictionServiceImpl.sumWeatherRainInWindow().
     * Method này trả về 0 để tránh nhầm lẫn sensor count với mm mưa.
     */
    private float sumRainInWindow(Long deviceId, int hours) {
        return 0.0f;
    }

    /** Sum ETc (mm) tích lũy trong cửa sổ [now-hours, now] từ etcHistory. */
    private float sumEtcInWindow(List<Map<String, Object>> etcHistory, int hours) {
        if (etcHistory == null || etcHistory.isEmpty()) return 0.0f;
        LocalDateTime cutoff = LocalDateTime.now().minusHours(hours);
        float sum = 0.0f;
        for (Map<String, Object> entry : etcHistory) {
            if (parseTimestamp((String) entry.get("timestamp")).isAfter(cutoff)) {
                Object val = entry.get("value");
                if (val instanceof Number) sum += ((Number) val).floatValue();
            }
        }
        return sum;
    }

    private static LocalDateTime parseTimestamp(String ts) {
        if (ts == null) {
            return LocalDateTime.MIN;
        }
        try {
            return LocalDateTime.parse(ts, ISO_FORMATTER);
        } catch (Exception e) {
            return LocalDateTime.MIN;
        }
    }

    private Double getDoubleValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
