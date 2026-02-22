package com.example.smart_garden.service;

import com.example.smart_garden.dto.device.request.*;
import com.example.smart_garden.dto.device.response.*;
import com.example.smart_garden.entity.enums.DeviceStatus;

import java.util.List;

/**
 * Service interface cho quản lý Device.
 */
public interface DeviceService {

    // ================== USER ==================

    /**
     * Lấy danh sách devices của user hiện tại.
     */
    List<UserDeviceListItemResponse> getMyDevices();

    /**
     * Lấy chi tiết device của user hiện tại.
     */
    UserDeviceDetailResponse getMyDeviceById(Long id);

    /**
     * Cập nhật device của user hiện tại.
     */
    UserDeviceDetailResponse updateMyDevice(Long id, UserUpdateDeviceRequest request);

    /**
     * Kết nối vườn với thiết bị ESP32 bằng địa chỉ MAC.
     * ESP32 dùng MAC (sau chuẩn hóa) làm device_code cho MQTT. Nếu thiết bị chưa có trong hệ thống
     * thì tạo device mới gán cho user hiện tại; nếu đã có và thuộc user khác thì báo lỗi.
     *
     * @return Thông tin device đã kết nối (đã có sẵn hoặc mới tạo).
     */
    UserDeviceDetailResponse connectDeviceByMac(String macAddress);

    // ================== ADMIN ==================

    /**
     * Admin tạo device mới.
     */
    AdminDeviceDetailResponse adminCreateDevice(AdminCreateDeviceRequest request);

    /**
     * Admin lấy danh sách tất cả devices.
     */
    List<AdminDeviceListItemResponse> adminGetAllDevices();

    /**
     * Admin lấy chi tiết device theo ID.
     */
    AdminDeviceDetailResponse adminGetDeviceById(Long id);

    /**
     * Admin cập nhật device.
     */
    AdminDeviceDetailResponse adminUpdateDevice(Long id, AdminUpdateDeviceRequest request);

    /**
     * Admin xóa device (soft delete).
     */
    void adminDeleteDevice(Long id);

    /**
     * Cập nhật trạng thái device theo deviceCode (từ MQTT: status, heartbeat, LWT).
     * Nếu status = ONLINE thì lastOnline = now.
     */
    void updateStatusByDeviceCode(String deviceCode, DeviceStatus status);
}
