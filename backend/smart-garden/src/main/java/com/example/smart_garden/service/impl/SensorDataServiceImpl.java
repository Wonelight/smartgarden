package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataHourlyResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.SensorData;
import com.example.smart_garden.entity.SensorDataHourly;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.SensorDataMapper;
import com.example.smart_garden.mqtt.payload.MqttSensorPayload;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.SensorDataHourlyRepository;
import com.example.smart_garden.repository.SensorDataRepository;
import com.example.smart_garden.service.SensorDataBuffer;
import com.example.smart_garden.service.SensorDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation của SensorDataService.
 *
 * Sensor data giờ được lưu dạng JSON payload thay vì cột riêng lẻ.
 * Ingest từ MQTT đi qua SensorDataBuffer (batch insert).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorDataServiceImpl implements SensorDataService {

    private final SensorDataRepository sensorDataRepository;
    private final SensorDataHourlyRepository sensorDataHourlyRepository;
    private final DeviceRepository deviceRepository;
    private final SensorDataMapper sensorDataMapper;
    private final SensorDataBuffer sensorDataBuffer;

    @Override
    @Transactional(readOnly = true)
    public SensorDataDetailResponse getLatestByDeviceId(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        SensorData sensorData = sensorDataRepository.findFirstByDeviceIdOrderByTimestampDesc(deviceId)
                .orElse(null);

        if (sensorData == null) {
            return null;
        }

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

    /**
     * Lấy dữ liệu hourly aggregated — cho dashboard charts range > 24h.
     * Giảm ~360x lượng data so với raw sensor_data.
     */
    @Override
    @Transactional(readOnly = true)
    public List<SensorDataHourlyResponse> getHourlyByDeviceIdAndTimeRange(
            Long deviceId,
            LocalDateTime startTime,
            LocalDateTime endTime) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        List<SensorDataHourly> hourlyList = sensorDataHourlyRepository
                .findByDeviceIdAndHourStartBetweenOrderByHourStartDesc(deviceId, startTime, endTime);

        return sensorDataMapper.toHourlyResponses(hourlyList);
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

    /**
     * Ingest sensor data từ MQTT — lưu dạng JSON payload vào buffer.
     * Buffer sẽ flush batch mỗi 30s hoặc khi đạt 50 items.
     */
    @Override
    public void ingestFromMqtt(String deviceCode, MqttSensorPayload payload) {
        if (payload == null)
            return;

        Device device = deviceRepository.findByDeviceCode(deviceCode)
                .orElse(null);
        if (device == null) {
            log.warn("MQTT sensor ingest: unknown deviceCode={}", deviceCode);
            return;
        }

        LocalDateTime timestamp = payload.timestampAsInstant() != null
                ? LocalDateTime.ofInstant(payload.timestampAsInstant(), ZoneOffset.UTC)
                : LocalDateTime.now();

        // Convert MQTT payload thành JSON map
        Map<String, Object> jsonPayload = buildPayloadMap(payload);

        SensorData data = SensorData.builder()
                .device(device)
                .payload(jsonPayload)
                .timestamp(timestamp)
                .build();

        // Thêm vào buffer thay vì save trực tiếp
        sensorDataBuffer.add(data);
        log.debug("Buffered MQTT sensor data for device {} at {}", deviceCode, timestamp);
    }

    /**
     * Chuyển MqttSensorPayload thành Map để lưu JSON.
     * Chỉ include non-null values.
     */
    private Map<String, Object> buildPayloadMap(MqttSensorPayload payload) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (payload.getSoilMoisture() != null)
            map.put("soilMoisture", payload.getSoilMoisture());
        if (payload.getSoilMoisture2() != null)
            map.put("soilMoisture2", payload.getSoilMoisture2());
        if (payload.getTemperature() != null)
            map.put("temperature", payload.getTemperature());
        if (payload.getHumidity() != null)
            map.put("humidity", payload.getHumidity());
        if (payload.getLightIntensity() != null)
            map.put("lightIntensity", payload.getLightIntensity());
        if (payload.getRainDetected() != null)
            map.put("rainDetected", payload.getRainDetected());
        if (payload.getRainIntensity() != null)
            map.put("rainIntensity", payload.getRainIntensity());
        if (payload.getAmbientLight() != null)
            map.put("ambientLight", payload.getAmbientLight());
        if (payload.getPumpState() != null)
            map.put("pumpState", payload.getPumpState());
        if (payload.getLightState() != null)
            map.put("lightState", payload.getLightState());
        return map;
    }
}
