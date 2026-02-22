package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.crop.request.AdminCreateCropLibraryRequest;
import com.example.smart_garden.dto.crop.request.AdminUpdateCropLibraryRequest;
import com.example.smart_garden.dto.crop.response.CropLibraryDetailResponse;
import com.example.smart_garden.dto.crop.response.CropLibraryListItemResponse;
import com.example.smart_garden.service.CropLibraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API quản lý Crop Library (admin only).
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class CropLibraryController {

    private final CropLibraryService cropLibraryService;

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PostMapping(ApiPaths.SEG_ADMIN_CROP_LIBRARIES)
    public ApiResponse<CropLibraryDetailResponse> adminCreateCropLibrary(
            @Valid @RequestBody AdminCreateCropLibraryRequest request) {
        return ApiResponse.ok(cropLibraryService.adminCreateCropLibrary(request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_CROP_LIBRARIES)
    public ApiResponse<List<CropLibraryListItemResponse>> adminGetAllCropLibraries() {
        return ApiResponse.ok(cropLibraryService.adminGetAllCropLibraries());
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_CROP_LIBRARY_ID)
    public ApiResponse<CropLibraryDetailResponse> adminGetCropLibraryById(@PathVariable Long id) {
        return ApiResponse.ok(cropLibraryService.adminGetCropLibraryById(id));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PutMapping(ApiPaths.SEG_ADMIN_CROP_LIBRARY_ID)
    public ApiResponse<CropLibraryDetailResponse> adminUpdateCropLibrary(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateCropLibraryRequest request) {
        return ApiResponse.ok(cropLibraryService.adminUpdateCropLibrary(id, request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @DeleteMapping(ApiPaths.SEG_ADMIN_CROP_LIBRARY_ID)
    public ApiResponse<Void> adminDeleteCropLibrary(@PathVariable Long id) {
        cropLibraryService.adminDeleteCropLibrary(id);
        return ApiResponse.ok(null);
    }
}
