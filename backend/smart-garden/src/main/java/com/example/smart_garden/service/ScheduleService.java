package com.example.smart_garden.service;

import com.example.smart_garden.dto.schedule.request.UpsertScheduleRequest;
import com.example.smart_garden.dto.schedule.response.ScheduleDetailResponse;
import com.example.smart_garden.dto.schedule.response.ScheduleListItemResponse;

import java.util.List;

/**
 * Service interface cho quản lý Schedule (Lịch tưới).
 */
public interface ScheduleService {

    /**
     * Lấy danh sách lịch tưới của device.
     */
    List<ScheduleListItemResponse> getSchedulesByDeviceId(Long deviceId);

    /**
     * Lấy chi tiết lịch tưới theo ID.
     */
    ScheduleDetailResponse getScheduleById(Long id);

    /**
     * Tạo lịch tưới mới.
     */
    ScheduleDetailResponse createSchedule(UpsertScheduleRequest request);

    /**
     * Cập nhật lịch tưới.
     */
    ScheduleDetailResponse updateSchedule(Long id, UpsertScheduleRequest request);

    /**
     * Xóa lịch tưới (soft delete).
     */
    void deleteSchedule(Long id);

    /**
     * Bật/tắt lịch tưới.
     */
    ScheduleDetailResponse toggleScheduleActive(Long id, boolean isActive);
}
