package com.example.smart_garden.controller;

import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.permission.request.CreatePermissionRequest;
import com.example.smart_garden.dto.permission.request.UpdatePermissionRequest;
import com.example.smart_garden.dto.permission.response.PermissionResponse;
import com.example.smart_garden.service.PermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Permission management.
 * All endpoints require ADMIN role.
 */
@RestController
@RequestMapping("/v1/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;

    /**
     * Get all permissions.
     *
     * @return List of all permissions
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<PermissionResponse>> getAllPermissions() {
        List<PermissionResponse> permissions = permissionService.getAllPermissions();
        return ApiResponse.ok(permissions);
    }

    /**
     * Get permission by ID.
     *
     * @param id Permission ID
     * @return Permission details
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PermissionResponse> getPermissionById(@PathVariable Long id) {
        PermissionResponse permission = permissionService.getPermissionById(id);
        return ApiResponse.ok(permission);
    }

    /**
     * Get permissions by category.
     *
     * @param category Permission category
     * @return List of permissions in the category
     */
    @GetMapping("/category/{category}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<PermissionResponse>> getPermissionsByCategory(@PathVariable String category) {
        List<PermissionResponse> permissions = permissionService.getPermissionsByCategory(category);
        return ApiResponse.ok(permissions);
    }

    /**
     * Create a new permission.
     *
     * @param request Create permission request
     * @return Created permission
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PermissionResponse> createPermission(@Valid @RequestBody CreatePermissionRequest request) {
        PermissionResponse permission = permissionService.createPermission(request);
        return ApiResponse.ok(permission);
    }

    /**
     * Update an existing permission.
     *
     * @param id      Permission ID
     * @param request Update permission request
     * @return Updated permission
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PermissionResponse> updatePermission(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePermissionRequest request) {
        PermissionResponse permission = permissionService.updatePermission(id, request);
        return ApiResponse.ok(permission);
    }

    /**
     * Delete a permission.
     *
     * @param id Permission ID
     * @return Success response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deletePermission(@PathVariable Long id) {
        permissionService.deletePermission(id);
        return ApiResponse.ok(null);
    }
}
