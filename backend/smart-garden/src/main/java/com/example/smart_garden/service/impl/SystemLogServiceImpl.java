package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.logs.response.SystemLogResponse;
import com.example.smart_garden.entity.SystemLog;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.SystemLogRepository;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.service.SystemLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation của SystemLogService.
 */
@Service
@RequiredArgsConstructor
public class SystemLogServiceImpl implements SystemLogService {

    private final SystemLogRepository systemLogRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SystemLogResponse> getMyLogs(int page, int size, LogLevel level, LogSource source) {
        User user = getCurrentUser();
        Page<SystemLog> result = systemLogRepository.findByUserIdWithFilters(
                user.getId(), level, source, PageRequest.of(page, size));
        return toPageResponse(result);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SystemLogResponse> adminGetAllLogs(int page, int size, LogLevel level, LogSource source) {
        Page<SystemLog> result = systemLogRepository.findAllWithFilters(
                level, source, PageRequest.of(page, size));
        return toPageResponse(result);
    }

    // ========== helpers ==========

    private PageResponse<SystemLogResponse> toPageResponse(Page<SystemLog> page) {
        var content = page.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(
                content,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
    }

    private SystemLogResponse toResponse(SystemLog log) {
        Long deviceId = log.getDevice() != null ? log.getDevice().getId() : null;
        String deviceName = log.getDevice() != null ? log.getDevice().getDeviceName() : null;
        return new SystemLogResponse(
                log.getId(),
                log.getLogLevel(),
                log.getLogSource(),
                deviceId,
                deviceName,
                log.getMessage(),
                log.getStackTrace(),
                log.getCreatedAt()
        );
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
