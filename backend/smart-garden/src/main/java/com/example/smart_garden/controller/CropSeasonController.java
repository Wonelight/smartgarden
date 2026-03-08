package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.crop.request.CropSeasonCreateRequest;
import com.example.smart_garden.dto.crop.response.CropRecommendationResponse;
import com.example.smart_garden.dto.crop.response.CropSeasonDetailResponse;
import com.example.smart_garden.service.CropSeasonService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(ApiPaths.BASE + "/crop-season")
@RequiredArgsConstructor
@Tag(name = "Crop Season", description = "Quản lý mùa vụ cho thiết bị")
public class CropSeasonController {

    private final CropSeasonService cropSeasonService;

    @Operation(summary = "Lấy vụ mùa hiện hành của thiết bị")
    @GetMapping("/device/{deviceId}/active")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<CropSeasonDetailResponse> getActiveSeason(@PathVariable Long deviceId) {
        CropSeasonDetailResponse season = cropSeasonService.getActiveSeason(deviceId);
        return ApiResponse.ok(season); // có thể trả về null nếu chưa có
    }

    @Operation(summary = "Bắt đầu vụ mùa mới cho thiết bị")
    @PostMapping("/device/{deviceId}")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<CropSeasonDetailResponse> startNewSeason(
            @PathVariable Long deviceId,
            @Valid @RequestBody CropSeasonCreateRequest request) {
        CropSeasonDetailResponse season = cropSeasonService.startNewSeason(deviceId, request);
        return ApiResponse.ok(season);
    }

    @Operation(summary = "Kết thúc vụ mùa hiện hành")
    @PutMapping("/device/{deviceId}/end")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<Void> endActiveSeason(@PathVariable Long deviceId) {
        cropSeasonService.endActiveSeason(deviceId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "Gợi ý cây trồng dựa theo thời tiết và vị trí của thiết bị")
    @GetMapping("/device/{deviceId}/recommendations")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<List<CropRecommendationResponse>> getRecommendations(@PathVariable Long deviceId) {
        List<CropRecommendationResponse> recommendations = cropSeasonService.getRecommendations(deviceId);
        return ApiResponse.ok(recommendations);
    }
}
