package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.role.request.AssignPermissionsRequest;
import com.example.smart_garden.dto.role.request.CreateRoleRequest;
import com.example.smart_garden.dto.role.request.UpdateRoleRequest;
import com.example.smart_garden.dto.role.response.RoleDetailResponse;
import com.example.smart_garden.dto.role.response.RoleListItemResponse;
import com.example.smart_garden.dto.user.response.PublicUserListItemResponse;
import com.example.smart_garden.entity.Permission;
import com.example.smart_garden.entity.Role;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.RoleMapper;
import com.example.smart_garden.mapper.UserMapper;
import com.example.smart_garden.repository.PermissionRepository;
import com.example.smart_garden.repository.RoleRepository;
import com.example.smart_garden.service.RoleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Implementation of RoleService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RoleMapper roleMapper;
    private final UserMapper userMapper;

    @Override
    @Transactional(readOnly = true)
    public List<RoleListItemResponse> getAllRoles() {
        log.debug("Getting all roles");
        return roleRepository.findAll().stream()
                .map(roleMapper::toListItemResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public RoleDetailResponse getRoleById(Long id) {
        log.debug("Getting role by ID: {}", id);
        Role role = roleRepository.findByIdWithPermissions(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        return roleMapper.toDetailResponse(role);
    }

    @Override
    @Transactional
    public RoleDetailResponse createRole(CreateRoleRequest request) {
        log.info("Creating role: {}", request.name());

        // Check if role already exists
        if (roleRepository.existsByName(request.name())) {
            throw new AppException(ErrorCode.ROLE_EXISTED);
        }

        // Create role entity
        Role role = roleMapper.toEntity(request);

        // Fetch and assign permissions
        Set<Permission> permissions = new HashSet<>();
        for (Long permissionId : request.permissionIds()) {
            Permission permission = permissionRepository.findById(permissionId)
                    .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
            permissions.add(permission);
        }
        role.setPermissions(permissions);

        Role savedRole = roleRepository.save(role);

        log.info("Role created successfully: {}", savedRole.getName());
        return roleMapper.toDetailResponse(savedRole);
    }

    @Override
    @Transactional
    public RoleDetailResponse updateRole(Long id, UpdateRoleRequest request) {
        log.info("Updating role: {}", id);

        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        roleMapper.updateEntityFromRequest(request, role);
        Role updatedRole = roleRepository.save(role);

        log.info("Role updated successfully: {}", updatedRole.getName());
        return roleMapper.toDetailResponse(updatedRole);
    }

    @Override
    @Transactional
    public void deleteRole(Long id) {
        log.info("Deleting role: {}", id);

        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        // Check if it's a system role
        if (role.getIsSystem()) {
            log.warn("Cannot delete system role: {}", role.getName());
            throw new AppException(ErrorCode.SYSTEM_ROLE_CANNOT_BE_DELETED);
        }

        // Check if role is in use (assigned to any user)
        if (!role.getUsers().isEmpty()) {
            log.warn("Cannot delete role {} - it is assigned to {} users",
                    role.getName(), role.getUsers().size());
            throw new AppException(ErrorCode.ROLE_IN_USE);
        }

        role.softDelete();
        roleRepository.save(role);

        log.info("Role deleted successfully: {}", role.getName());
    }

    @Override
    @Transactional
    public RoleDetailResponse assignPermissions(Long roleId, AssignPermissionsRequest request) {
        log.info("Assigning permissions to role: {}", roleId);

        Role role = roleRepository.findByIdWithPermissions(roleId)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        // Fetch permissions to assign
        for (Long permissionId : request.permissionIds()) {
            Permission permission = permissionRepository.findById(permissionId)
                    .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
            role.addPermission(permission);
        }

        Role updatedRole = roleRepository.save(role);

        log.info("Permissions assigned successfully to role: {}", updatedRole.getName());
        return roleMapper.toDetailResponse(updatedRole);
    }

    @Override
    @Transactional
    public RoleDetailResponse removePermissions(Long roleId, List<Long> permissionIds) {
        log.info("Removing permissions from role: {}", roleId);

        Role role = roleRepository.findByIdWithPermissions(roleId)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        // Find and remove permissions
        for (Long permissionId : permissionIds) {
            Permission permission = permissionRepository.findById(permissionId)
                    .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
            role.removePermission(permission);
        }

        Role updatedRole = roleRepository.save(role);

        log.info("Permissions removed successfully from role: {}", updatedRole.getName());
        return roleMapper.toDetailResponse(updatedRole);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublicUserListItemResponse> getUsersByRole(Long roleId) {
        log.debug("Getting users by role: {}", roleId);

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));

        return role.getUsers().stream()
                .map(userMapper::toPublicListItem)
                .collect(Collectors.toList());
    }
}
