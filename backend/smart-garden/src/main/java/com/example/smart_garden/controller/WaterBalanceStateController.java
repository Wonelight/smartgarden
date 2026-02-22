package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;
import com.example.smart_garden.service.WaterBalanceStateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * API endpoints cho Water Balance State operations.
 * Được sử dụng bởi AI service để lưu trữ và truy xuất state.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class WaterBalanceStateController {

    private final WaterBalanceStateService waterBalanceStateService;

    /**
     * Lấy water balance state của device.
     * Nếu chưa có, tạo mới với giá trị mặc định.
     */
    @GetMapping(ApiPaths.SEG_DEVICE_WATER_BALANCE_STATE)
    public ApiResponse<WaterBalanceStateResponse> getState(
            @PathVariable Long deviceId) {
        return ApiResponse.ok(waterBalanceStateService.getState(deviceId));
    }

    /**
     * Cập nhật water balance state của device.
     * Được gọi từ AI service sau mỗi prediction cycle.
     */
    @PutMapping(ApiPaths.SEG_DEVICE_WATER_BALANCE_STATE)
    public ApiResponse<WaterBalanceStateResponse> updateState(
            @PathVariable Long deviceId,
            @Valid @RequestBody UpdateWaterBalanceStateRequest request) {
        return ApiResponse.ok(waterBalanceStateService.updateState(deviceId, request));
    }
}
