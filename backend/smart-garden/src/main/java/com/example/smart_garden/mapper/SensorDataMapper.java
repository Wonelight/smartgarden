package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataHourlyResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import com.example.smart_garden.entity.SensorData;
import com.example.smart_garden.entity.SensorDataHourly;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper cho SensorData entity và DTOs.
 *
 * SensorData giờ dùng JSON payload — mapping thông qua @Transient getters
 * (getSoilMoisture(), getTemperature(), etc.) tự động extract từ JSON.
 */
@Mapper(componentModel = "spring")
public interface SensorDataMapper {

    // ================== Entity to Response ==================

    @Mapping(target = "deviceId", source = "device.id")
    SensorDataDetailResponse toDetail(SensorData sensorData);

    SensorDataListItemResponse toListItem(SensorData sensorData);

    List<SensorDataListItemResponse> toListItems(List<SensorData> sensorDataList);

    // ================== Hourly ==================

    @Mapping(target = "deviceId", source = "device.id")
    SensorDataHourlyResponse toHourlyResponse(SensorDataHourly hourly);

    List<SensorDataHourlyResponse> toHourlyResponses(List<SensorDataHourly> hourlyList);
}
