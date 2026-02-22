package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.control.request.UserDeviceControlRequest;
import com.example.smart_garden.dto.control.response.DeviceControlListItemResponse;
import com.example.smart_garden.service.DeviceControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API điều khiển thiết bị: gửi lệnh, xem lịch sử và lệnh đang chờ.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class DeviceControlController {

    private final DeviceControlService deviceControlService;

    @PostMapping(ApiPaths.SEG_DEVICES_CONTROLS)
    public ApiResponse<DeviceControlListItemResponse> sendControlCommand(
            @Valid @RequestBody UserDeviceControlRequest request) {
        return ApiResponse.ok(deviceControlService.sendControlCommand(request));
    }

    @GetMapping(ApiPaths.SEG_DEVICE_CONTROLS)
    public ApiResponse<PageResponse<DeviceControlListItemResponse>> getByDeviceId(
            @PathVariable Long deviceId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<DeviceControlListItemResponse> page = deviceControlService.getByDeviceId(deviceId, pageable);
        PageResponse<DeviceControlListItemResponse> response = new PageResponse<>(
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

    @GetMapping(ApiPaths.SEG_DEVICE_CONTROLS_PENDING)
    public ApiResponse<List<DeviceControlListItemResponse>> getPendingByDeviceId(@PathVariable Long deviceId) {
        return ApiResponse.ok(deviceControlService.getPendingByDeviceId(deviceId));
    }

    @PatchMapping(ApiPaths.SEG_CONTROLS_STATUS)
    public ApiResponse<Void> updateControlStatus(
            @PathVariable Long controlId,
            @RequestParam String status) {
        deviceControlService.updateControlStatus(controlId, status);
        return ApiResponse.ok(null);
    }
}
