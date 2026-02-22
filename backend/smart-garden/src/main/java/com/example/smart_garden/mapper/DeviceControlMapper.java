package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.control.request.UserDeviceControlRequest;
import com.example.smart_garden.dto.control.response.DeviceControlListItemResponse;
import com.example.smart_garden.entity.DeviceControl;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper cho DeviceControl entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface DeviceControlMapper {

    // ================== Entity to Response ==================

    @Mapping(target = "deviceId", source = "device.id")
    @Mapping(target = "userId", source = "user.id")
    DeviceControlListItemResponse toListItem(DeviceControl deviceControl);

    List<DeviceControlListItemResponse> toListItems(List<DeviceControl> deviceControls);

    // ================== Request to Entity ==================

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "device", ignore = true) // Device sẽ được set trong service
    @Mapping(target = "user", ignore = true) // User sẽ được set trong service
    @Mapping(target = "initiatedBy", constant = "USER")
    @Mapping(target = "status", constant = "PENDING")
    @Mapping(target = "executedAt", ignore = true)
    DeviceControl toEntity(UserDeviceControlRequest request);
}
