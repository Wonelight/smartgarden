package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.user.request.AdminCreateUserRequest;
import com.example.smart_garden.dto.user.request.SelfRegisterUserRequest;
import com.example.smart_garden.dto.user.response.AdminUserDetailResponse;
import com.example.smart_garden.dto.user.response.AdminUserListItemResponse;
import com.example.smart_garden.dto.user.response.PublicUserListItemResponse;
import com.example.smart_garden.dto.user.response.SelfUserDetailResponse;
import com.example.smart_garden.entity.Role;
import com.example.smart_garden.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * MapStruct mapper cho User entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    // ================== Entity to Response ==================

    @Mapping(target = "roles", source = "roles", qualifiedByName = "mapRolesToStrings")
    SelfUserDetailResponse toSelfDetail(User user);

    @Mapping(target = "roles", source = "roles", qualifiedByName = "mapRolesToStrings")
    AdminUserDetailResponse toAdminDetail(User user);

    @Mapping(target = "roles", source = "roles", qualifiedByName = "mapRolesToStrings")
    AdminUserListItemResponse toAdminListItem(User user);

    PublicUserListItemResponse toPublicListItem(User user);

    List<AdminUserListItemResponse> toAdminListItems(List<User> users);

    // ================== Request to Entity ==================

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true) // Password sẽ được encode riêng
    @Mapping(target = "roles", ignore = true) // Roles will be set separately by UserService
    @Mapping(target = "isActive", constant = "true")
    @Mapping(target = "devices", ignore = true)
    @Mapping(target = "deviceControls", ignore = true)
    User toEntity(SelfRegisterUserRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "roles", ignore = true) // Roles will be set separately
    @Mapping(target = "devices", ignore = true)
    @Mapping(target = "deviceControls", ignore = true)
    User toEntity(AdminCreateUserRequest request);

    @Named("mapRolesToStrings")
    default Set<String> mapRolesToStrings(Set<Role> roles) {
        if (roles == null) {
            return Set.of();
        }
        return roles.stream()
                .map(Role::getName)
                .collect(Collectors.toSet());
    }
}
