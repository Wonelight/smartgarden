package com.example.smart_garden.service;

import com.example.smart_garden.dto.waterbalance.request.UpdateWaterBalanceStateRequest;
import com.example.smart_garden.dto.waterbalance.response.WaterBalanceStateResponse;

import java.util.List;
import java.util.Map;

/**
 * Service interface cho quản lý Water Balance State.
 * Được sử dụng bởi AI service để lưu trữ và truy xuất state.
 */
public interface WaterBalanceStateService {

    /**
     * Lấy water balance state của device.
     * Nếu chưa có, tạo mới với giá trị mặc định.
     */
    WaterBalanceStateResponse getState(Long deviceId);

    /**
     * Cập nhật water balance state của device.
     */
    WaterBalanceStateResponse updateState(Long deviceId, UpdateWaterBalanceStateRequest request);

    /**
     * Tính toán soil moisture trend từ history.
     */
    Float calculateSoilMoisTrend(List<Map<String, Object>> history);
}
