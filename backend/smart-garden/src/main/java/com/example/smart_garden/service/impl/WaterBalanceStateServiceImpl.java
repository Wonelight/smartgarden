package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.DeviceWaterBalanceState;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.DeviceWaterBalanceStateRepository;
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
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_DATE_TIME;
    private static final int TREND_WINDOW = 6; // ~1h nếu mỗi 10 phút đọc 1 lần

    @Override
    @Transactional(readOnly = true)
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
        DeviceWaterBalanceState state = DeviceWaterBalanceState.builder()
                .device(device)
                .shallowDepletion(0.0f)
                .shallowTaw(0.0f)
                .shallowRaw(0.0f)
                .deepDepletion(0.0f)
                .deepTaw(0.0f)
                .deepRaw(0.0f)
                .lastIrrigation(0.0f)
                .soilMoisHistory(new ArrayList<>())
                .build();
        return stateRepository.save(state);
    }

    private WaterBalanceStateResponse mapToResponse(DeviceWaterBalanceState state) {
        Float trend = calculateSoilMoisTrend(state.getSoilMoisHistory());
        return new WaterBalanceStateResponse(
                state.getDevice().getId(),
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
                state.getUpdatedAt()
        );
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
