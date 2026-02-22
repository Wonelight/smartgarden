package com.example.smart_garden.service;

import com.example.smart_garden.dto.irrigation.request.AdminUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.request.UserPartialUpdateIrrigationConfigRequest;
import com.example.smart_garden.dto.irrigation.response.IrrigationConfigDetailResponse;
import com.example.smart_garden.dto.irrigation.response.IrrigationHistoryListItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service interface cho quản lý Irrigation (Cấu hình và lịch sử tưới).
 */
public interface IrrigationService {

    // ================== IRRIGATION CONFIG ==================

    /**
     * Lấy cấu hình tưới của device.
     */
    IrrigationConfigDetailResponse getConfigByDeviceId(Long deviceId);

    /**
     * User cập nhật một phần cấu hình tưới.
     */
    IrrigationConfigDetailResponse userUpdateConfig(Long deviceId, UserPartialUpdateIrrigationConfigRequest request);

    /**
     * Admin cập nhật toàn bộ cấu hình tưới.
     */
    IrrigationConfigDetailResponse adminUpdateConfig(Long deviceId, AdminUpdateIrrigationConfigRequest request);

    // ================== IRRIGATION HISTORY ==================

    /**
     * Lấy lịch sử tưới của device với phân trang.
     */
    Page<IrrigationHistoryListItemResponse> getHistoryByDeviceId(Long deviceId, Pageable pageable);

    /**
     * Lấy lịch sử tưới trong khoảng thời gian.
     */
    List<IrrigationHistoryListItemResponse> getHistoryByTimeRange(
            Long deviceId,
            LocalDateTime startTime,
            LocalDateTime endTime);

    /**
     * Tính tổng thời gian tưới trong khoảng thời gian.
     */
    Long getTotalDuration(Long deviceId, LocalDateTime startTime, LocalDateTime endTime);
}
