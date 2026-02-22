package com.example.smart_garden.service;

import com.example.smart_garden.dto.role.request.AssignPermissionsRequest;
import com.example.smart_garden.dto.role.request.CreateRoleRequest;
import com.example.smart_garden.dto.role.request.UpdateRoleRequest;
import com.example.smart_garden.dto.role.response.RoleDetailResponse;
import com.example.smart_garden.dto.role.response.RoleListItemResponse;
import com.example.smart_garden.dto.user.response.PublicUserListItemResponse;

import java.util.List;

/**
 * Service interface for Role management.
 */
public interface RoleService {

    /**
     * Get all roles.
     *
     * @return List of all roles
     */
    List<RoleListItemResponse> getAllRoles();

    /**
     * Get role by ID with permissions.
     *
     * @param id Role ID
     * @return Role detail response
     */
    RoleDetailResponse getRoleById(Long id);

    /**
     * Create a new role with permissions.
     *
     * @param request Create role request
     * @return Created role detail response
     */
    RoleDetailResponse createRole(CreateRoleRequest request);

    /**
     * Update an existing role.
     *
     * @param id      Role ID
     * @param request Update role request
     * @return Updated role detail response
     */
    RoleDetailResponse updateRole(Long id, UpdateRoleRequest request);

    /**
     * Delete a role by ID.
     * System roles cannot be deleted.
     * Role must not be assigned to any user.
     *
     * @param id Role ID
     */
    void deleteRole(Long id);

    /**
     * Assign permissions to a role.
     *
     * @param roleId  Role ID
     * @param request Assign permissions request
     * @return Updated role detail response
     */
    RoleDetailResponse assignPermissions(Long roleId, AssignPermissionsRequest request);

    /**
     * Remove permissions from a role.
     *
     * @param roleId        Role ID
     * @param permissionIds List of permission IDs to remove
     * @return Updated role detail response
     */
    RoleDetailResponse removePermissions(Long roleId, List<Long> permissionIds);

    /**
     * Get users who have a specific role.
     *
     * @param roleId Role ID
     * @return List of users with this role
     */
    List<PublicUserListItemResponse> getUsersByRole(Long roleId);
}
