package com.example.smart_garden.service;

import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service interface cho quản lý SensorData (Dữ liệu cảm biến).
 */
public interface SensorDataService {

    /**
     * Lấy dữ liệu cảm biến mới nhất của device.
     */
    SensorDataDetailResponse getLatestByDeviceId(Long deviceId);

    /**
     * Lấy danh sách dữ liệu cảm biến của device với phân trang.
     */
    Page<SensorDataListItemResponse> getByDeviceId(Long deviceId, Pageable pageable);

    /**
     * Lấy dữ liệu cảm biến trong khoảng thời gian.
     */
    List<SensorDataListItemResponse> getByDeviceIdAndTimeRange(
            Long deviceId,
            LocalDateTime startTime,
            LocalDateTime endTime);

    /**
     * Xóa dữ liệu cảm biến cũ hơn một thời điểm.
     */
    void deleteOldData(Long deviceId, LocalDateTime beforeTime);

    /**
     * Ingest dữ liệu cảm biến từ MQTT (device nhận diện bằng deviceCode).
     * Dùng khi nhận message từ topic smart_garden/devices/{deviceCode}/sensor.
     */
    void ingestFromMqtt(String deviceCode, com.example.smart_garden.mqtt.payload.MqttSensorPayload payload);
}
