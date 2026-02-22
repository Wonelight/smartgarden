package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import com.example.smart_garden.entity.SensorData;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper cho SensorData entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface SensorDataMapper {

    // ================== Entity to Response ==================

    @Mapping(target = "deviceId", source = "device.id")
    SensorDataDetailResponse toDetail(SensorData sensorData);

    SensorDataListItemResponse toListItem(SensorData sensorData);

    List<SensorDataListItemResponse> toListItems(List<SensorData> sensorDataList);
}
