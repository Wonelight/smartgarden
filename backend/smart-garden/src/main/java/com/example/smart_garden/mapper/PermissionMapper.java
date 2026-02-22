package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.permission.request.CreatePermissionRequest;
import com.example.smart_garden.dto.permission.request.UpdatePermissionRequest;
import com.example.smart_garden.dto.permission.response.PermissionResponse;
import com.example.smart_garden.entity.Permission;
import org.mapstruct.*;

import java.util.Set;

/**
 * MapStruct mapper for Permission entity.
 */
@Mapper(componentModel = "spring")
public interface PermissionMapper {

    /**
     * Map Permission entity to PermissionResponse DTO.
     */
    PermissionResponse toResponse(Permission permission);

    /**
     * Map set of Permission entities to set of PermissionResponse DTOs.
     */
    Set<PermissionResponse> toResponseSet(Set<Permission> permissions);

    /**
     * Map CreatePermissionRequest to Permission entity.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "roles", ignore = true)
    Permission toEntity(CreatePermissionRequest request);

    /**
     * Update existing Permission entity with data from UpdatePermissionRequest.
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "name", ignore = true)
    @Mapping(target = "roles", ignore = true)
    void updateEntityFromRequest(UpdatePermissionRequest request, @MappingTarget Permission permission);
}
