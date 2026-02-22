package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.control.request.UserDeviceControlRequest;
import com.example.smart_garden.dto.control.response.DeviceControlListItemResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.DeviceControl;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlStatus;
import com.example.smart_garden.entity.enums.ControlType;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.DeviceControlMapper;
import com.example.smart_garden.mqtt.MqttCommandSender;
import com.example.smart_garden.repository.DeviceControlRepository;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.service.DeviceControlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implementation của DeviceControlService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceControlServiceImpl implements DeviceControlService {

    private final DeviceControlRepository deviceControlRepository;
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final DeviceControlMapper deviceControlMapper;
    private final MqttCommandSender mqttCommandSender;

    @Override
    @Transactional
    public DeviceControlListItemResponse sendControlCommand(UserDeviceControlRequest request) {
        log.info("Sending control command to device: {}", request.deviceId());

        Device device = deviceRepository.findById(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        User user = getCurrentUser();

        DeviceControl control = deviceControlMapper.toEntity(request);
        control.setDevice(device);
        control.setUser(user);

        control = deviceControlRepository.save(control);

        // Gửi command qua MQTT và chờ ACK (timeout/retry)
        String mqttCmd = toMqttCommand(request.controlType(), request.action());
        Integer setpoint = null; // SET_SETPOINT có thể bổ sung qua API riêng
        if (mqttCmd != null) {
            boolean ackOk = mqttCommandSender.sendAndWaitAck(device.getDeviceCode(), mqttCmd, setpoint);
            control.setStatus(ackOk ? ControlStatus.EXECUTED : ControlStatus.FAILED);
            if (ackOk) control.setExecutedAt(LocalDateTime.now());
            deviceControlRepository.save(control);
        }

        log.info("Created control command: {} for device: {}, status={}", control.getId(), device.getDeviceCode(), control.getStatus());
        return deviceControlMapper.toListItem(control);
    }

    /**
     * Map REST control type/action sang MQTT cmd: PUMP_ON, PUMP_OFF, AUTO, SET_SETPOINT.
     */
    private String toMqttCommand(ControlType controlType, ControlAction action) {
        if (controlType == ControlType.PUMP) {
            if (action == ControlAction.ON) return "PUMP_ON";
            if (action == ControlAction.OFF) return "PUMP_OFF";
        }
        if (controlType == ControlType.SYSTEM && action == ControlAction.OFF) {
            return "AUTO"; // Chuyển về auto mode
        }
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DeviceControlListItemResponse> getByDeviceId(Long deviceId, Pageable pageable) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        return deviceControlRepository.findByDeviceIdOrderByCreatedAtDesc(deviceId, pageable)
                .map(deviceControlMapper::toListItem);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeviceControlListItemResponse> getPendingByDeviceId(Long deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        List<DeviceControl> pendingControls = deviceControlRepository.findPendingByDeviceId(deviceId);
        return deviceControlMapper.toListItems(pendingControls);
    }

    @Override
    @Transactional
    public void updateControlStatus(Long controlId, String status) {
        DeviceControl control = deviceControlRepository.findById(controlId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Control command not found"));

        ControlStatus controlStatus;
        try {
            controlStatus = ControlStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Invalid control status: " + status);
        }

        control.setStatus(controlStatus);
        if (controlStatus == ControlStatus.EXECUTED || controlStatus == ControlStatus.FAILED) {
            control.setExecutedAt(LocalDateTime.now());
        }

        deviceControlRepository.save(control);
        log.info("Updated control {} status to: {}", controlId, status);
    }

    // ================== HELPER METHODS ==================

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
