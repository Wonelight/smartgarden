package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.irrigation.response.IrrigationConfigDetailResponse;
import com.example.smart_garden.dto.irrigation.response.IrrigationHistoryListItemResponse;
import com.example.smart_garden.entity.IrrigationConfig;
import com.example.smart_garden.entity.IrrigationHistory;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper cho Irrigation entities và DTOs.
 */
@Mapper(componentModel = "spring")
public interface IrrigationMapper {

    // ================== IrrigationConfig ==================

    @Mapping(target = "deviceId", source = "device.id")
    IrrigationConfigDetailResponse toConfigDetail(IrrigationConfig config);

    // ================== IrrigationHistory ==================

    @Mapping(target = "deviceId", source = "device.id")
    IrrigationHistoryListItemResponse toHistoryListItem(IrrigationHistory history);

    List<IrrigationHistoryListItemResponse> toHistoryListItems(List<IrrigationHistory> histories);
}
