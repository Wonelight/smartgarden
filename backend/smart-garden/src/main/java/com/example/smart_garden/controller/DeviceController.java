package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.device.request.AdminCreateDeviceRequest;
import com.example.smart_garden.dto.device.request.AdminUpdateDeviceRequest;
import com.example.smart_garden.dto.device.request.ConnectDeviceRequest;
import com.example.smart_garden.dto.device.request.UserUpdateDeviceRequest;
import com.example.smart_garden.dto.device.response.AdminDeviceDetailResponse;
import com.example.smart_garden.dto.device.response.AdminDeviceListItemResponse;
import com.example.smart_garden.dto.device.response.UserDeviceDetailResponse;
import com.example.smart_garden.dto.device.response.UserDeviceListItemResponse;
import com.example.smart_garden.service.DeviceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API quản lý thiết bị: user (devices của mình), admin (tất cả devices).
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    // ================== USER ==================

    @GetMapping(ApiPaths.SEG_DEVICES)
    public ApiResponse<List<UserDeviceListItemResponse>> getMyDevices() {
        return ApiResponse.ok(deviceService.getMyDevices());
    }

    @GetMapping(ApiPaths.SEG_DEVICES + ApiPaths.SEG_DEVICE_ID)
    public ApiResponse<UserDeviceDetailResponse> getMyDeviceById(@PathVariable Long id) {
        return ApiResponse.ok(deviceService.getMyDeviceById(id));
    }

    @PutMapping(ApiPaths.SEG_DEVICES + ApiPaths.SEG_DEVICE_ID)
    public ApiResponse<UserDeviceDetailResponse> updateMyDevice(
            @PathVariable Long id,
            @Valid @RequestBody UserUpdateDeviceRequest request) {
        return ApiResponse.ok(deviceService.updateMyDevice(id, request));
    }

    @PostMapping(ApiPaths.SEG_DEVICES_CONNECT)
    public ApiResponse<UserDeviceDetailResponse> connectDevice(@Valid @RequestBody ConnectDeviceRequest request) {
        return ApiResponse.ok(deviceService.connectDeviceByMac(request.macAddress()));
    }

    // ================== ADMIN ==================

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PostMapping(ApiPaths.SEG_ADMIN_DEVICES)
    public ApiResponse<AdminDeviceDetailResponse> adminCreateDevice(
            @Valid @RequestBody AdminCreateDeviceRequest request) {
        return ApiResponse.ok(deviceService.adminCreateDevice(request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_DEVICES)
    public ApiResponse<List<AdminDeviceListItemResponse>> adminGetAllDevices() {
        return ApiResponse.ok(deviceService.adminGetAllDevices());
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_DEVICE_ID)
    public ApiResponse<AdminDeviceDetailResponse> adminGetDeviceById(@PathVariable Long id) {
        return ApiResponse.ok(deviceService.adminGetDeviceById(id));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PutMapping(ApiPaths.SEG_ADMIN_DEVICE_ID)
    public ApiResponse<AdminDeviceDetailResponse> adminUpdateDevice(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateDeviceRequest request) {
        return ApiResponse.ok(deviceService.adminUpdateDevice(id, request));
    }

    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @DeleteMapping(ApiPaths.SEG_ADMIN_DEVICE_ID)
    public ApiResponse<Void> adminDeleteDevice(@PathVariable Long id) {
        deviceService.adminDeleteDevice(id);
        return ApiResponse.ok(null);
    }
}
