package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.device.request.*;
import com.example.smart_garden.dto.device.response.*;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.entity.enums.DeviceStatus;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.DeviceMapper;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.service.DeviceService;
import com.example.smart_garden.util.MacAddressUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implementation của DeviceService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceServiceImpl implements DeviceService {

    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final DeviceMapper deviceMapper;

    // ================== USER ==================

    @Override
    @Transactional(readOnly = true)
    public List<UserDeviceListItemResponse> getMyDevices() {
        User user = getCurrentUser();
        List<Device> devices = deviceRepository.findByUserId(user.getId());
        return deviceMapper.toUserListItems(devices);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDeviceDetailResponse getMyDeviceById(Long id) {
        User user = getCurrentUser();
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // Check ownership
        if (device.getUser() == null || !device.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Device does not belong to you");
        }

        return deviceMapper.toUserDetail(device);
    }

    @Override
    @Transactional
    public UserDeviceDetailResponse updateMyDevice(Long id, UserUpdateDeviceRequest request) {
        User user = getCurrentUser();
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // Check ownership
        if (device.getUser() == null || !device.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Device does not belong to you");
        }

        if (request.deviceName() != null) {
            device.setDeviceName(request.deviceName());
        }
        if (request.location() != null) {
            device.setLocation(request.location());
        }
        if (request.latitude() != null) {
            device.setLatitude(request.latitude());
        }
        if (request.longitude() != null) {
            device.setLongitude(request.longitude());
        }
        if (request.altitude() != null) {
            device.setAltitude(request.altitude());
        }

        device = deviceRepository.save(device);
        log.info("User {} updated device: {}", user.getUsername(), device.getDeviceCode());

        return deviceMapper.toUserDetail(device);
    }

    @Override
    @Transactional
    public UserDeviceDetailResponse connectDeviceByMac(String macAddress) {
        String deviceCode = MacAddressUtils.normalize(macAddress);
        if (deviceCode == null || !MacAddressUtils.isValid(deviceCode)) {
            throw new AppException(ErrorCode.INVALID_MAC_ADDRESS);
        }

        User user = getCurrentUser();

        var existingOpt = deviceRepository.findByDeviceCode(deviceCode);
        if (existingOpt.isPresent()) {
            Device device = existingOpt.get();
            if (device.getUser() == null) {
                device.setUser(user);
                device = deviceRepository.save(device);
                log.info("User {} linked unassigned device: {}", user.getUsername(), deviceCode);
                return deviceMapper.toUserDetail(device);
            }
            if (!device.getUser().getId().equals(user.getId())) {
                throw new AppException(ErrorCode.DEVICE_ALREADY_REGISTERED);
            }
            log.info("User {} already has device: {}", user.getUsername(), deviceCode);
            return deviceMapper.toUserDetail(device);
        }

        Device device = Device.builder()
                .deviceCode(deviceCode)
                .deviceName("Vườn " + deviceCode.substring(6))
                .user(user)
                .status(DeviceStatus.OFFLINE)
                .build();
        device = deviceRepository.save(device);
        log.info("User {} connected new device by MAC: {}", user.getUsername(), deviceCode);
        return deviceMapper.toUserDetail(device);
    }

    @Override
    @Transactional
    public void disconnectMyDevice(Long id) {
        User user = getCurrentUser();
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (device.getUser() == null || !device.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Device does not belong to you");
        }

        device.setUser(null);
        deviceRepository.save(device);
        log.info("User {} disconnected device: {}", user.getUsername(), device.getDeviceCode());
    }

    @Override
    @Transactional
    public void deleteMyDevice(Long id) {
        User user = getCurrentUser();
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (device.getUser() == null || !device.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Device does not belong to you");
        }

        device.softDelete();
        deviceRepository.save(device);
        log.info("User {} deleted device: {}", user.getUsername(), device.getDeviceCode());
    }

    // ================== ADMIN ==================

    @Override
    @Transactional
    public AdminDeviceDetailResponse adminCreateDevice(AdminCreateDeviceRequest request) {
        log.info("Admin creating device: {}", request.deviceCode());

        if (deviceRepository.existsByDeviceCode(request.deviceCode())) {
            throw new AppException(ErrorCode.DEVICE_EXISTED, "Device code already exists");
        }

        Device device = deviceMapper.toEntity(request);

        // Set user if provided
        if (request.userId() != null) {
            User user = userRepository.findById(request.userId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            device.setUser(user);
        }

        device = deviceRepository.save(device);
        log.info("Admin created device: {}", device.getDeviceCode());

        return deviceMapper.toAdminDetail(device);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminDeviceListItemResponse> adminGetAllDevices() {
        List<Device> devices = deviceRepository.findAll();
        return deviceMapper.toAdminListItems(devices);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminDeviceDetailResponse adminGetDeviceById(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));
        return deviceMapper.toAdminDetail(device);
    }

    @Override
    @Transactional
    public AdminDeviceDetailResponse adminUpdateDevice(Long id, AdminUpdateDeviceRequest request) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (request.deviceName() != null) {
            device.setDeviceName(request.deviceName());
        }
        if (request.location() != null) {
            device.setLocation(request.location());
        }
        if (request.latitude() != null) {
            device.setLatitude(request.latitude());
        }
        if (request.longitude() != null) {
            device.setLongitude(request.longitude());
        }
        if (request.altitude() != null) {
            device.setAltitude(request.altitude());
        }
        if (request.status() != null) {
            device.setStatus(request.status());
        }
        if (request.firmwareVersion() != null) {
            device.setFirmwareVersion(request.firmwareVersion());
        }

        // Update user if provided
        if (request.userId() != null) {
            User user = userRepository.findById(request.userId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            device.setUser(user);
        }

        device = deviceRepository.save(device);
        log.info("Admin updated device: {}", device.getDeviceCode());

        return deviceMapper.toAdminDetail(device);
    }

    @Override
    @Transactional
    public void adminDeleteDevice(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        device.softDelete();
        deviceRepository.save(device);
        log.info("Admin deleted device: {}", device.getDeviceCode());
    }

    @Override
    @Transactional
    public void updateStatusByDeviceCode(String deviceCode, DeviceStatus status) {
        deviceRepository.findByDeviceCode(deviceCode).ifPresent(device -> {
            device.setStatus(status);
            if (status == DeviceStatus.ONLINE) {
                device.setLastOnline(java.time.LocalDateTime.now());
            }
            deviceRepository.save(device);
            log.debug("Updated device {} status to {}", deviceCode, status);
        });
    }

    // ================== HELPER METHODS ==================

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
