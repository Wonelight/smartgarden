package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.irrigation.request.AdminUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.request.UserPartialUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.response.IrrigationConfigDetailResponse;
import com.example.smart_garden.dto.irrigation.response.IrrigationHistoryListItemResponse;
import com.example.smart_garden.service.IrrigationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * API cấu hình tưới và lịch sử tưới theo device.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class IrrigationController {

    private final IrrigationService irrigationService;

    // ================== IRRIGATION CONFIG ==================

    @GetMapping(ApiPaths.SEG_DEVICE_IRRIGATION_CONFIG)
    public ApiResponse<IrrigationConfigDetailResponse> getConfigByDeviceId(@PathVariable Long deviceId) {
        return ApiResponse.ok(irrigationService.getConfigByDeviceId(deviceId));
    }

    @PutMapping(ApiPaths.SEG_DEVICE_IRRIGATION_CONFIG)
    public ApiResponse<IrrigationConfigDetailResponse> userUpdateConfig(
            @PathVariable Long deviceId,
            @Valid @RequestBody UserPartialUpdateIrrigationConfigRequest request) {
        return ApiResponse.ok(irrigationService.userUpdateConfig(deviceId, request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PutMapping(ApiPaths.SEG_ADMIN_DEVICE_IRRIGATION_CONFIG)
    public ApiResponse<IrrigationConfigDetailResponse> adminUpdateConfig(
            @PathVariable Long deviceId,
            @Valid @RequestBody AdminUpdateIrrigationConfigRequest request) {
        return ApiResponse.ok(irrigationService.adminUpdateConfig(deviceId, request));
    }

    // ================== IRRIGATION HISTORY ==================

    @GetMapping(ApiPaths.SEG_DEVICE_IRRIGATION_HISTORY)
    public ApiResponse<PageResponse<IrrigationHistoryListItemResponse>> getHistoryByDeviceId(
            @PathVariable Long deviceId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<IrrigationHistoryListItemResponse> page = irrigationService.getHistoryByDeviceId(deviceId, pageable);
        PageResponse<IrrigationHistoryListItemResponse> response = new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
        return ApiResponse.ok(response);
    }

    @GetMapping(ApiPaths.SEG_DEVICE_IRRIGATION_HISTORY_RANGE)
    public ApiResponse<List<IrrigationHistoryListItemResponse>> getHistoryByTimeRange(
            @PathVariable Long deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        return ApiResponse.ok(irrigationService.getHistoryByTimeRange(deviceId, startTime, endTime));
    }

    @GetMapping(ApiPaths.SEG_DEVICE_IRRIGATION_DURATION)
    public ApiResponse<Map<String, Long>> getTotalDuration(
            @PathVariable Long deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        Long total = irrigationService.getTotalDuration(deviceId, startTime, endTime);
        return ApiResponse.ok(Map.of("totalDurationMinutes", total));
    }
}
