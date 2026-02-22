package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.SensorData;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.SensorDataMapper;
import com.example.smart_garden.mqtt.payload.MqttSensorPayload;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.service.SensorDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Implementation của SensorDataService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorDataServiceImpl implements SensorDataService {

    private final SensorDataRepository sensorDataRepository;
    private final DeviceRepository deviceRepository;
    private final SensorDataMapper sensorDataMapper;

    @Override
    @Transactional(readOnly = true)
    public SensorDataDetailResponse getLatestByDeviceId(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        SensorData sensorData = sensorDataRepository.findFirstByDeviceIdOrderByTimestampDesc(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_SENSOR_DATA, "No sensor data found"));

        return sensorDataMapper.toDetail(sensorData);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SensorDataListItemResponse> getByDeviceId(Long deviceId, Pageable pageable) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        return sensorDataRepository.findByDeviceIdOrderByTimestampDesc(deviceId, pageable)
                .map(sensorDataMapper::toListItem);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SensorDataListItemResponse> getByDeviceIdAndTimeRange(
            Long deviceId,
            LocalDateTime startTime,
            LocalDateTime endTime) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        List<SensorData> sensorDataList = sensorDataRepository
                .findByDeviceIdAndTimestampBetween(deviceId, startTime, endTime);

        return sensorDataMapper.toListItems(sensorDataList);
    }

    @Override
    @Transactional
    public void deleteOldData(Long deviceId, LocalDateTime beforeTime) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        sensorDataRepository.deleteByDeviceIdAndTimestampBefore(deviceId, beforeTime);
        log.info("Deleted sensor data for device {} before {}", deviceId, beforeTime);
    }

    @Override
    @Transactional
    public void ingestFromMqtt(String deviceCode, MqttSensorPayload payload) {
        if (payload == null) return;

        Device device = deviceRepository.findByDeviceCode(deviceCode)
                .orElse(null);
        if (device == null) {
            log.warn("MQTT sensor ingest: unknown deviceCode={}", deviceCode);
            return;
        }

        LocalDateTime timestamp = payload.timestampAsInstant() != null
                ? LocalDateTime.ofInstant(payload.timestampAsInstant(), ZoneOffset.UTC)
                : LocalDateTime.now();

        SensorData data = SensorData.builder()
                .device(device)
                .soilMoisture(payload.getSoilMoisture())
                .soilMoisture2(payload.getSoilMoisture2())
                .temperature(payload.getTemperature())
                .humidity(payload.getHumidity())
                .lightIntensity(payload.getLightIntensity())
                .rainDetected(Boolean.TRUE.equals(payload.getRainDetected()))
                .ambientLight(payload.getAmbientLight())
                .timestamp(timestamp)
                .build();
        sensorDataRepository.save(data);
        log.debug("Ingested MQTT sensor data for device {} at {}", deviceCode, timestamp);
    }
}
