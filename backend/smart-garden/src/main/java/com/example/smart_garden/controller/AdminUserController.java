package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.user.request.AdminCreateUserRequest;
import com.example.smart_garden.dto.user.request.AdminUpdateUserRequest;
import com.example.smart_garden.dto.user.response.AdminUserDetailResponse;
import com.example.smart_garden.dto.user.response.AdminUserListItemResponse;
import com.example.smart_garden.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API quản lý user (admin). Path /admin/users vì context-path đã là /api.
 */
@RestController
@RequestMapping(ApiPaths.SEG_ADMIN_USERS)
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PostMapping
    public ApiResponse<AdminUserDetailResponse> adminCreateUser(
            @Valid @RequestBody AdminCreateUserRequest request) {
        return ApiResponse.ok(userService.adminCreateUser(request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping
    public ApiResponse<List<AdminUserListItemResponse>> adminGetAllUsers() {
        return ApiResponse.ok(userService.adminGetAllUsers());
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping("/{id}")
    public ApiResponse<AdminUserDetailResponse> adminGetUserById(@PathVariable Long id) {
        return ApiResponse.ok(userService.adminGetUserById(id));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PutMapping("/{id}")
    public ApiResponse<AdminUserDetailResponse> adminUpdateUser(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateUserRequest request) {
        return ApiResponse.ok(userService.adminUpdateUser(id, request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> adminDeleteUser(@PathVariable Long id) {
        userService.adminDeleteUser(id);
        return ApiResponse.ok(null);
    }
}
