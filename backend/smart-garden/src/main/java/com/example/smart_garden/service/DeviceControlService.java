package com.example.smart_garden.service;

import com.example.smart_garden.dto.control.request.UserDeviceControlRequest;
import com.example.smart_garden.dto.control.response.DeviceControlListItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Service interface cho quản lý DeviceControl (Lệnh điều khiển thiết bị).
 */
public interface DeviceControlService {

    /**
     * Gửi lệnh điều khiển thiết bị.
     */
    DeviceControlListItemResponse sendControlCommand(UserDeviceControlRequest request);

    /**
     * Lấy danh sách lệnh điều khiển của device với phân trang.
     */
    Page<DeviceControlListItemResponse> getByDeviceId(Long deviceId, Pageable pageable);

    /**
     * Lấy danh sách lệnh điều khiển đang chờ thực thi.
     */
    List<DeviceControlListItemResponse> getPendingByDeviceId(Long deviceId);

    /**
     * Cập nhật trạng thái lệnh điều khiển sau khi thực thi.
     */
    void updateControlStatus(Long controlId, String status);
}
