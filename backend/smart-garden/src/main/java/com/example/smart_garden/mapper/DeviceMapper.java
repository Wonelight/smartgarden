package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.device.request.AdminCreateDeviceRequest;
import com.example.smart_garden.dto.device.response.AdminDeviceDetailResponse;
import com.example.smart_garden.dto.device.response.AdminDeviceListItemResponse;
import com.example.smart_garden.dto.device.response.UserDeviceDetailResponse;
import com.example.smart_garden.dto.device.response.UserDeviceListItemResponse;
import com.example.smart_garden.entity.Device;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper cho Device entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface DeviceMapper {

    // ================== Entity to Response (User) ==================

    UserDeviceDetailResponse toUserDetail(Device device);

    UserDeviceListItemResponse toUserListItem(Device device);

    List<UserDeviceListItemResponse> toUserListItems(List<Device> devices);

    // ================== Entity to Response (Admin) ==================

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "username", source = "user.username")
    AdminDeviceDetailResponse toAdminDetail(Device device);

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "username", source = "user.username")
    AdminDeviceListItemResponse toAdminListItem(Device device);

    List<AdminDeviceListItemResponse> toAdminListItems(List<Device> devices);

    // ================== Request to Entity ==================

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "user", ignore = true) // User sẽ được set trong service
    @Mapping(target = "status", constant = "OFFLINE")
    @Mapping(target = "lastOnline", ignore = true)
    @Mapping(target = "firmwareVersion", ignore = true)
    @Mapping(target = "sensorDataList", ignore = true)
    @Mapping(target = "irrigationConfig", ignore = true)
    @Mapping(target = "fuzzyLogicResults", ignore = true)
    @Mapping(target = "mlPredictions", ignore = true)
    @Mapping(target = "irrigationHistories", ignore = true)
    @Mapping(target = "deviceControls", ignore = true)
    @Mapping(target = "systemLogs", ignore = true)
    @Mapping(target = "schedules", ignore = true)
    @Mapping(target = "cropSeasons", ignore = true)
    Device toEntity(AdminCreateDeviceRequest request);
}
