package com.example.smart_garden.controller;

import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.role.request.AssignPermissionsRequest;
import com.example.smart_garden.dto.role.request.CreateRoleRequest;
import com.example.smart_garden.dto.role.request.UpdateRoleRequest;
import com.example.smart_garden.dto.role.response.RoleDetailResponse;
import com.example.smart_garden.dto.role.response.RoleListItemResponse;
import com.example.smart_garden.dto.user.response.PublicUserListItemResponse;
import com.example.smart_garden.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Role management.
 * All endpoints require ADMIN role.
 */
@RestController
@RequestMapping("/v1/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    /**
     * Get all roles.
     *
     * @return List of all roles
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<RoleListItemResponse>> getAllRoles() {
        List<RoleListItemResponse> roles = roleService.getAllRoles();
        return ApiResponse.ok(roles);
    }

    /**
     * Get role by ID with permissions.
     *
     * @param id Role ID
     * @return Role details with permissions
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RoleDetailResponse> getRoleById(@PathVariable Long id) {
        RoleDetailResponse role = roleService.getRoleById(id);
        return ApiResponse.ok(role);
    }

    /**
     * Create a new role.
     *
     * @param request Create role request
     * @return Created role details
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RoleDetailResponse> createRole(@Valid @RequestBody CreateRoleRequest request) {
        RoleDetailResponse role = roleService.createRole(request);
        return ApiResponse.ok(role);
    }

    /**
     * Update an existing role.
     *
     * @param id      Role ID
     * @param request Update role request
     * @return Updated role details
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RoleDetailResponse> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request) {
        RoleDetailResponse role = roleService.updateRole(id, request);
        return ApiResponse.ok(role);
    }

    /**
     * Delete a role.
     *
     * @param id Role ID
     * @return Success response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteRole(@PathVariable Long id) {
        roleService.deleteRole(id);
        return ApiResponse.ok(null);
    }

    /**
     * Assign permissions to a role.
     *
     * @param id      Role ID
     * @param request Assign permissions request
     * @return Updated role details
     */
    @PostMapping("/{id}/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RoleDetailResponse> assignPermissions(
            @PathVariable Long id,
            @Valid @RequestBody AssignPermissionsRequest request) {
        RoleDetailResponse role = roleService.assignPermissions(id, request);
        return ApiResponse.ok(role);
    }

    /**
     * Remove permissions from a role.
     *
     * @param id            Role ID
     * @param permissionIds List of permission IDs to remove
     * @return Updated role details
     */
    @DeleteMapping("/{id}/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RoleDetailResponse> removePermissions(
            @PathVariable Long id,
            @RequestBody List<Long> permissionIds) {
        RoleDetailResponse role = roleService.removePermissions(id, permissionIds);
        return ApiResponse.ok(role);
    }

    /**
     * Get users who have a specific role.
     *
     * @param id Role ID
     * @return List of users with this role
     */
    @GetMapping("/{id}/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<PublicUserListItemResponse>> getUsersByRole(@PathVariable Long id) {
        List<PublicUserListItemResponse> users = roleService.getUsersByRole(id);
        return ApiResponse.ok(users);
    }
}
