package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.irrigation.request.AdminUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.request.UserPartialUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.response.IrrigationConfigDetailResponse;
import com.example.smart_garden.dto.irrigation.response.IrrigationHistoryListItemResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.IrrigationConfig;
import com.example.smart_garden.entity.IrrigationHistory;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.IrrigationMapper;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.IrrigationConfigRepository;
import com.example.smart_garden.repository.IrrigationHistoryRepository;
import com.example.smart_garden.service.IrrigationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implementation của IrrigationService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IrrigationServiceImpl implements IrrigationService {

    private final IrrigationConfigRepository irrigationConfigRepository;
    private final IrrigationHistoryRepository irrigationHistoryRepository;
    private final DeviceRepository deviceRepository;
    private final IrrigationMapper irrigationMapper;

    // ================== IRRIGATION CONFIG ==================

    @Override
    @Transactional
    public IrrigationConfigDetailResponse getConfigByDeviceId(Long deviceId) {
        IrrigationConfig config = irrigationConfigRepository.findByDeviceId(deviceId)
                .orElseGet(() -> createDefaultConfig(deviceId));
        return irrigationMapper.toConfigDetail(config);
    }

    @Override
    @Transactional
    public IrrigationConfigDetailResponse userUpdateConfig(Long deviceId,
            UserPartialUpdateIrrigationConfigRequest request) {
        IrrigationConfig config = irrigationConfigRepository.findByDeviceId(deviceId)
                .orElseGet(() -> createDefaultConfig(deviceId));

        // User can only update limited fields
        if (request.soilMoistureOptimal() != null) {
            config.setSoilMoistureOptimal(request.soilMoistureOptimal());
        }
        if (request.irrigationDurationMin() != null) {
            config.setIrrigationDurationMin(request.irrigationDurationMin());
        }
        if (request.irrigationDurationMax() != null) {
            config.setIrrigationDurationMax(request.irrigationDurationMax());
        }
        if (request.autoMode() != null) {
            config.setAutoMode(request.autoMode());
        }
        if (request.fuzzyEnabled() != null) {
            config.setFuzzyEnabled(request.fuzzyEnabled());
        }
        if (request.aiEnabled() != null) {
            config.setAiEnabled(request.aiEnabled());
        }
        if (request.pumpFlowRate() != null) {
            config.setPumpFlowRate(request.pumpFlowRate());
        }
        if (request.nozzleCount() != null) {
            config.setNozzleCount(request.nozzleCount());
        }

        config = irrigationConfigRepository.save(config);
        log.info("User updated irrigation config for device: {}", deviceId);

        return irrigationMapper.toConfigDetail(config);
    }

    @Override
    @Transactional
    public IrrigationConfigDetailResponse adminUpdateConfig(Long deviceId, AdminUpdateIrrigationConfigRequest request) {
        IrrigationConfig config = irrigationConfigRepository.findByDeviceId(deviceId)
                .orElseGet(() -> createDefaultConfig(deviceId));

        // Admin can update all fields
        if (request.soilMoistureMin() != null) {
            config.setSoilMoistureMin(request.soilMoistureMin());
        }
        if (request.soilMoistureMax() != null) {
            config.setSoilMoistureMax(request.soilMoistureMax());
        }
        if (request.soilMoistureOptimal() != null) {
            config.setSoilMoistureOptimal(request.soilMoistureOptimal());
        }
        if (request.tempMin() != null) {
            config.setTempMin(request.tempMin());
        }
        if (request.tempMax() != null) {
            config.setTempMax(request.tempMax());
        }
        if (request.lightThreshold() != null) {
            config.setLightThreshold(request.lightThreshold());
        }
        if (request.irrigationDurationMin() != null) {
            config.setIrrigationDurationMin(request.irrigationDurationMin());
        }
        if (request.irrigationDurationMax() != null) {
            config.setIrrigationDurationMax(request.irrigationDurationMax());
        }
        if (request.fuzzyEnabled() != null) {
            config.setFuzzyEnabled(request.fuzzyEnabled());
        }
        if (request.autoMode() != null) {
            config.setAutoMode(request.autoMode());
        }
        if (request.aiEnabled() != null) {
            config.setAiEnabled(request.aiEnabled());
        }
        if (request.pumpFlowRate() != null) {
            config.setPumpFlowRate(request.pumpFlowRate());
        }
        if (request.nozzleCount() != null) {
            config.setNozzleCount(request.nozzleCount());
        }

        config = irrigationConfigRepository.save(config);
        log.info("Admin updated irrigation config for device: {}", deviceId);

        return irrigationMapper.toConfigDetail(config);
    }

    // ================== IRRIGATION HISTORY ==================

    @Override
    @Transactional
    public void ingestHistoryFromMqtt(String deviceCode,
            com.example.smart_garden.mqtt.payload.MqttIrrigationHistoryPayload payload) {
        Device device = deviceRepository.findByDeviceCode(deviceCode)
                .orElse(null);
        if (device == null) {
            log.warn("Ingest history: device {} not found", deviceCode);
            return;
        }

        com.example.smart_garden.entity.enums.IrrigationMode mappedMode = com.example.smart_garden.entity.enums.IrrigationMode.MANUAL;
        if (payload.getMode() != null && (payload.getMode().startsWith("AUTO") || payload.getMode().startsWith("AI"))) {
            mappedMode = com.example.smart_garden.entity.enums.IrrigationMode.AUTO;
        }

        com.example.smart_garden.entity.enums.IrrigationHistoryStatus mappedStatus =
                com.example.smart_garden.entity.enums.IrrigationHistoryStatus.COMPLETED;
        if ("AI_INTERRUPT".equals(payload.getMode())) {
            mappedStatus = com.example.smart_garden.entity.enums.IrrigationHistoryStatus.INTERRUPTED;
        }

        // Tính waterVolume từ duration × pumpFlowRate × nozzleCount (ESP32 không gửi waterVolume)
        float flowRate = irrigationConfigRepository.findByDeviceId(device.getId())
                .map(c -> c.getPumpFlowRate() != null ? c.getPumpFlowRate() : 0.5f)
                .orElse(0.5f);
        int nozzles = irrigationConfigRepository.findByDeviceId(device.getId())
                .map(c -> c.getNozzleCount() != null ? c.getNozzleCount() : 1)
                .orElse(1);
        float computedWaterVolume = payload.getDuration() / 60.0f * flowRate * nozzles;

        IrrigationHistory history = IrrigationHistory.builder()
                .device(device)
                .irrigationMode(mappedMode)
                .duration(payload.getDuration())
                .waterVolume(computedWaterVolume)
                .startTime(LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(payload.getStartTime()),
                        java.time.ZoneId.systemDefault()))
                .endTime(LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(payload.getEndTime()),
                        java.time.ZoneId.systemDefault()))
                .soilMoistureBefore(payload.getSoilMoistureBefore())
                .soilMoistureAfter(payload.getSoilMoistureAfter())
                .status(mappedStatus)
                .build();

        irrigationHistoryRepository.save(history);
        log.info("Ingested irrigation history: device={}, duration={}s, vol={}L", deviceCode, payload.getDuration(),
                payload.getWaterVolume());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<IrrigationHistoryListItemResponse> getHistoryByDeviceId(Long deviceId, Pageable pageable) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        return irrigationHistoryRepository.findByDeviceIdOrderByStartTimeDesc(deviceId, pageable)
                .map(irrigationMapper::toHistoryListItem);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IrrigationHistoryListItemResponse> getHistoryByTimeRange(
            Long deviceId,
            LocalDateTime startTime,
            LocalDateTime endTime) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        List<IrrigationHistory> histories = irrigationHistoryRepository
                .findByDeviceIdAndStartTimeBetween(deviceId, startTime, endTime);

        return irrigationMapper.toHistoryListItems(histories);
    }

    @Override
    @Transactional(readOnly = true)
    public Long getTotalDuration(Long deviceId, LocalDateTime startTime, LocalDateTime endTime) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        Long totalDuration = irrigationHistoryRepository.sumDurationByDeviceIdAndStartTimeBetween(deviceId, startTime,
                endTime);
        return totalDuration != null ? totalDuration : 0L;
    }

    // ================== HELPER METHODS ==================

    private IrrigationConfig createDefaultConfig(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        IrrigationConfig config = IrrigationConfig.builder()
                .device(device)
                .build();

        return irrigationConfigRepository.save(config);
    }
}
