package com.example.smart_garden.service;

import com.example.smart_garden.dto.permission.request.CreatePermissionRequest;
import com.example.smart_garden.dto.permission.request.UpdatePermissionRequest;
import com.example.smart_garden.dto.permission.response.PermissionResponse;

import java.util.List;

/**
 * Service interface for Permission management.
 */
public interface PermissionService {

    /**
     * Get all permissions.
     *
     * @return List of all permissions
     */
    List<PermissionResponse> getAllPermissions();

    /**
     * Get permission by ID.
     *
     * @param id Permission ID
     * @return Permission response
     */
    PermissionResponse getPermissionById(Long id);

    /**
     * Get permissions by category.
     *
     * @param category Permission category
     * @return List of permissions in the category
     */
    List<PermissionResponse> getPermissionsByCategory(String category);

    /**
     * Create a new permission.
     *
     * @param request Create permission request
     * @return Created permission response
     */
    PermissionResponse createPermission(CreatePermissionRequest request);

    /**
     * Update an existing permission.
     *
     * @param id      Permission ID
     * @param request Update permission request
     * @return Updated permission response
     */
    PermissionResponse updatePermission(Long id, UpdatePermissionRequest request);

    /**
     * Delete a permission by ID.
     * Permission must not be assigned to any role.
     *
     * @param id Permission ID
     */
    void deletePermission(Long id);
}
