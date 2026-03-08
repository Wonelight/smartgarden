package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.logs.response.SystemLogResponse;
import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import com.example.smart_garden.service.SystemLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * API lấy nhật ký hệ thống.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class SystemLogController {

    private final SystemLogService systemLogService;

    /**
     * User xem logs của các thiết bị thuộc về mình.
     * GET /api/logs?page=0&size=20&level=INFO&source=BACKEND
     */
    @GetMapping(ApiPaths.SEG_LOGS)
    public ApiResponse<PageResponse<SystemLogResponse>> getMyLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) LogLevel level,
            @RequestParam(required = false) LogSource source) {
        return ApiResponse.ok(systemLogService.getMyLogs(page, size, level, source));
    }

    /**
     * Admin xem toàn bộ logs hệ thống.
     * GET /api/admin/logs?page=0&size=50&level=ERROR&source=BACKEND
     */
    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @GetMapping(ApiPaths.SEG_ADMIN_LOGS)
    public ApiResponse<PageResponse<SystemLogResponse>> adminGetAllLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) LogLevel level,
            @RequestParam(required = false) LogSource source) {
        return ApiResponse.ok(systemLogService.adminGetAllLogs(page, size, level, source));
    }
}
