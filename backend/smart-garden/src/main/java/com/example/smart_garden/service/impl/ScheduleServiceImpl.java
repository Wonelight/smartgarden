package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.schedule.request.UpsertScheduleRequest;
import com.example.smart_garden.dto.schedule.response.ScheduleDetailResponse;
import com.example.smart_garden.dto.schedule.response.ScheduleListItemResponse;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.Schedule;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.ScheduleMapper;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.ScheduleRepository;
import com.example.smart_garden.service.ScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implementation của ScheduleService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final DeviceRepository deviceRepository;
    private final ScheduleMapper scheduleMapper;

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleListItemResponse> getSchedulesByDeviceId(Long deviceId) {
        // Verify device exists
        if (!deviceRepository.existsById(deviceId)) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }
        List<Schedule> schedules = scheduleRepository.findByDeviceId(deviceId);
        return scheduleMapper.toListItems(schedules);
    }

    @Override
    @Transactional(readOnly = true)
    public ScheduleDetailResponse getScheduleById(Long id) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));
        return scheduleMapper.toDetail(schedule);
    }

    @Override
    @Transactional
    public ScheduleDetailResponse createSchedule(UpsertScheduleRequest request) {
        log.info("Creating schedule for device: {}", request.deviceId());

        Device device = deviceRepository.findById(request.deviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        Schedule schedule = scheduleMapper.toEntity(request);
        schedule.setDevice(device);

        if (request.isActive() == null) {
            schedule.setIsActive(true);
        }

        schedule = scheduleRepository.save(schedule);
        log.info("Created schedule: {} for device: {}", schedule.getId(), device.getDeviceCode());

        return scheduleMapper.toDetail(schedule);
    }

    @Override
    @Transactional
    public ScheduleDetailResponse updateSchedule(Long id, UpsertScheduleRequest request) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));

        // Update fields
        scheduleMapper.updateEntity(request, schedule);

        // Update device if changed
        if (!schedule.getDevice().getId().equals(request.deviceId())) {
            Device device = deviceRepository.findById(request.deviceId())
                    .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));
            schedule.setDevice(device);
        }

        schedule = scheduleRepository.save(schedule);
        log.info("Updated schedule: {}", schedule.getId());

        return scheduleMapper.toDetail(schedule);
    }

    @Override
    @Transactional
    public void deleteSchedule(Long id) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));

        schedule.softDelete();
        scheduleRepository.save(schedule);
        log.info("Deleted schedule: {}", id);
    }

    @Override
    @Transactional
    public ScheduleDetailResponse toggleScheduleActive(Long id, boolean isActive) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));

        schedule.setIsActive(isActive);
        schedule = scheduleRepository.save(schedule);
        log.info("Toggled schedule {} active: {}", id, isActive);

        return scheduleMapper.toDetail(schedule);
    }
}
