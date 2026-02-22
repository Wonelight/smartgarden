package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.schedule.request.UpsertScheduleRequest;
import com.example.smart_garden.dto.schedule.response.ScheduleDetailResponse;
import com.example.smart_garden.dto.schedule.response.ScheduleListItemResponse;
import com.example.smart_garden.entity.Schedule;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.util.List;

/**
 * MapStruct mapper cho Schedule entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface ScheduleMapper {

    // ================== Entity to Response ==================

    @Mapping(target = "deviceId", source = "device.id")
    ScheduleDetailResponse toDetail(Schedule schedule);

    @Mapping(target = "deviceId", source = "device.id")
    ScheduleListItemResponse toListItem(Schedule schedule);

    List<ScheduleListItemResponse> toListItems(List<Schedule> schedules);

    // ================== Request to Entity ==================

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "device", ignore = true) // Device sẽ được set trong service
    Schedule toEntity(UpsertScheduleRequest request);

    // ================== Update Entity ==================

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "device", ignore = true)
    void updateEntity(UpsertScheduleRequest request, @MappingTarget Schedule schedule);
}
