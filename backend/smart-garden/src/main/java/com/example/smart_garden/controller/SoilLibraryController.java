package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.soil.request.AdminCreateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.request.AdminUpdateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.response.SoilLibraryDetailResponse;
import com.example.smart_garden.dto.soil.response.SoilLibraryListItemResponse;
import com.example.smart_garden.service.SoilLibraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API quản lý Soil Library (admin only).
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class SoilLibraryController {

    private final SoilLibraryService soilLibraryService;

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PostMapping(ApiPaths.SEG_ADMIN_SOIL_LIBRARIES)
    public ApiResponse<SoilLibraryDetailResponse> adminCreateSoilLibrary(
            @Valid @RequestBody AdminCreateSoilLibraryRequest request) {
        return ApiResponse.ok(soilLibraryService.adminCreateSoilLibrary(request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_SOIL_LIBRARIES)
    public ApiResponse<List<SoilLibraryListItemResponse>> adminGetAllSoilLibraries() {
        return ApiResponse.ok(soilLibraryService.adminGetAllSoilLibraries());
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_SOIL_LIBRARY_ID)
    public ApiResponse<SoilLibraryDetailResponse> adminGetSoilLibraryById(@PathVariable Long id) {
        return ApiResponse.ok(soilLibraryService.adminGetSoilLibraryById(id));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PutMapping(ApiPaths.SEG_ADMIN_SOIL_LIBRARY_ID)
    public ApiResponse<SoilLibraryDetailResponse> adminUpdateSoilLibrary(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateSoilLibraryRequest request) {
        return ApiResponse.ok(soilLibraryService.adminUpdateSoilLibrary(id, request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @DeleteMapping(ApiPaths.SEG_ADMIN_SOIL_LIBRARY_ID)
    public ApiResponse<Void> adminDeleteSoilLibrary(@PathVariable Long id) {
        soilLibraryService.adminDeleteSoilLibrary(id);
        return ApiResponse.ok(null);
    }

    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    @GetMapping("/soil-libraries")
    public ApiResponse<List<SoilLibraryListItemResponse>> getAllSoilLibraries() {
        return ApiResponse.ok(soilLibraryService.adminGetAllSoilLibraries());
    }
}
