package com.example.smart_garden.service;

import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.logs.response.SystemLogResponse;
import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;

/**
 * Service interface cho System Logs.
 */
public interface SystemLogService {

    /**
     * User lấy logs của các thiết bị thuộc về mình (có lọc, phân trang).
     */
    PageResponse<SystemLogResponse> getMyLogs(int page, int size, LogLevel level, LogSource source);

    /**
     * Admin lấy toàn bộ logs hệ thống (có lọc, phân trang).
     */
    PageResponse<SystemLogResponse> adminGetAllLogs(int page, int size, LogLevel level, LogSource source);
}
