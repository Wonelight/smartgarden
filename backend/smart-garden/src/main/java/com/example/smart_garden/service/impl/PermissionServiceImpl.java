package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.permission.request.CreatePermissionRequest;
import com.example.smart_garden.dto.permission.request.UpdatePermissionRequest;
import com.example.smart_garden.dto.permission.response.PermissionResponse;
import com.example.smart_garden.entity.Permission;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.PermissionMapper;
import com.example.smart_garden.repository.PermissionRepository;
import com.example.smart_garden.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of PermissionService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final PermissionMapper permissionMapper;

    @Override
    @Transactional(readOnly = true)
    public List<PermissionResponse> getAllPermissions() {
        log.debug("Getting all permissions");
        return permissionRepository.findAll().stream()
                .map(permissionMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PermissionResponse getPermissionById(Long id) {
        log.debug("Getting permission by ID: {}", id);
        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));
        return permissionMapper.toResponse(permission);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionResponse> getPermissionsByCategory(String category) {
        log.debug("Getting permissions by category: {}", category);
        return permissionRepository.findByCategory(category).stream()
                .map(permissionMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PermissionResponse createPermission(CreatePermissionRequest request) {
        log.info("Creating permission: {}", request.name());

        // Check if permission already exists
        if (permissionRepository.existsByName(request.name())) {
            throw new AppException(ErrorCode.PERMISSION_EXISTED);
        }

        Permission permission = permissionMapper.toEntity(request);
        Permission savedPermission = permissionRepository.save(permission);

        log.info("Permission created successfully: {}", savedPermission.getName());
        return permissionMapper.toResponse(savedPermission);
    }

    @Override
    @Transactional
    public PermissionResponse updatePermission(Long id, UpdatePermissionRequest request) {
        log.info("Updating permission: {}", id);

        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));

        permissionMapper.updateEntityFromRequest(request, permission);
        Permission updatedPermission = permissionRepository.save(permission);

        log.info("Permission updated successfully: {}", updatedPermission.getName());
        return permissionMapper.toResponse(updatedPermission);
    }

    @Override
    @Transactional
    public void deletePermission(Long id) {
        log.info("Deleting permission: {}", id);

        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PERMISSION_NOT_FOUND));

        // Check if permission is in use (assigned to any role)
        if (!permission.getRoles().isEmpty()) {
            log.warn("Cannot delete permission {} - it is assigned to {} roles",
                    permission.getName(), permission.getRoles().size());
            throw new AppException(ErrorCode.PERMISSION_IN_USE);
        }

        permission.softDelete();
        permissionRepository.save(permission);

        log.info("Permission deleted successfully: {}", permission.getName());
    }
}
