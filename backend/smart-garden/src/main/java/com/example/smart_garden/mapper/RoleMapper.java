package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.role.request.CreateRoleRequest;
import com.example.smart_garden.dto.role.request.UpdateRoleRequest;
import com.example.smart_garden.dto.role.response.RoleDetailResponse;
import com.example.smart_garden.dto.role.response.RoleListItemResponse;
import com.example.smart_garden.entity.Role;
import org.mapstruct.*;

import java.util.List;

/**
 * MapStruct mapper for Role entity.
 */
@Mapper(componentModel = "spring", uses = { PermissionMapper.class })
public interface RoleMapper {

    /**
     * Map Role entity to RoleDetailResponse DTO.
     */
    @Mapping(target = "userCount", expression = "java(role.getUsers().size())")
    RoleDetailResponse toDetailResponse(Role role);

    /**
     * Map Role entity to RoleListItemResponse DTO.
     */
    @Mapping(target = "permissionCount", expression = "java(role.getPermissions().size())")
    RoleListItemResponse toListItemResponse(Role role);

    /**
     * Map list of Role entities to list of RoleListItemResponse DTOs.
     */
    List<RoleListItemResponse> toListItemResponseList(List<Role> roles);

    /**
     * Map CreateRoleRequest to Role entity.
     * Note: permissions will be set separately in the service layer.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "isSystem", constant = "false")
    @Mapping(target = "permissions", ignore = true)
    @Mapping(target = "users", ignore = true)
    Role toEntity(CreateRoleRequest request);

    /**
     * Update existing Role entity with data from UpdateRoleRequest.
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "permissions", ignore = true)
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "isSystem", ignore = true)
    void updateEntityFromRequest(UpdateRoleRequest request, @MappingTarget Role role);
}
