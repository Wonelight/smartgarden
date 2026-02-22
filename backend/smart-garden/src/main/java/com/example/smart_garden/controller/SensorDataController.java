package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataDetailResponse;
import com.example.smart_garden.dto.monitoring.response.SensorDataListItemResponse;
import com.example.smart_garden.service.SensorDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * API dữ liệu cảm biến theo device.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class SensorDataController {

    private final SensorDataService sensorDataService;

    @GetMapping(ApiPaths.SEG_DEVICE_SENSOR_DATA_LATEST)
    public ApiResponse<SensorDataDetailResponse> getLatestByDeviceId(@PathVariable Long deviceId) {
        return ApiResponse.ok(sensorDataService.getLatestByDeviceId(deviceId));
    }

    @GetMapping(ApiPaths.SEG_DEVICE_SENSOR_DATA)
    public ApiResponse<PageResponse<SensorDataListItemResponse>> getByDeviceId(
            @PathVariable Long deviceId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<SensorDataListItemResponse> page = sensorDataService.getByDeviceId(deviceId, pageable);
        PageResponse<SensorDataListItemResponse> response = new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
        return ApiResponse.ok(response);
    }

    @GetMapping(ApiPaths.SEG_DEVICE_SENSOR_DATA_RANGE)
    public ApiResponse<List<SensorDataListItemResponse>> getByDeviceIdAndTimeRange(
            @PathVariable Long deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        return ApiResponse.ok(sensorDataService.getByDeviceIdAndTimeRange(deviceId, startTime, endTime));
    }

    @DeleteMapping(ApiPaths.SEG_DEVICE_SENSOR_DATA)
    public ApiResponse<Void> deleteOldData(
            @PathVariable Long deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime beforeTime) {
        sensorDataService.deleteOldData(deviceId, beforeTime);
        return ApiResponse.ok(null);
    }
}
