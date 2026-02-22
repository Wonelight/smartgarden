package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.schedule.request.UpsertScheduleRequest;
import com.example.smart_garden.dto.schedule.response.ScheduleDetailResponse;
import com.example.smart_garden.dto.schedule.response.ScheduleListItemResponse;
import com.example.smart_garden.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API lịch tưới: theo device và CRUD lịch.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping(ApiPaths.SEG_DEVICE_SCHEDULES)
    public ApiResponse<List<ScheduleListItemResponse>> getSchedulesByDeviceId(@PathVariable Long deviceId) {
        return ApiResponse.ok(scheduleService.getSchedulesByDeviceId(deviceId));
    }

    @GetMapping(ApiPaths.SEG_SCHEDULES + ApiPaths.SEG_SCHEDULE_ID)
    public ApiResponse<ScheduleDetailResponse> getScheduleById(@PathVariable Long id) {
        return ApiResponse.ok(scheduleService.getScheduleById(id));
    }

    @PostMapping(ApiPaths.SEG_SCHEDULES)
    public ApiResponse<ScheduleDetailResponse> createSchedule(
            @Valid @RequestBody UpsertScheduleRequest request) {
        return ApiResponse.ok(scheduleService.createSchedule(request));
    }

    @PutMapping(ApiPaths.SEG_SCHEDULES + ApiPaths.SEG_SCHEDULE_ID)
    public ApiResponse<ScheduleDetailResponse> updateSchedule(
            @PathVariable Long id,
            @Valid @RequestBody UpsertScheduleRequest request) {
        return ApiResponse.ok(scheduleService.updateSchedule(id, request));
    }

    @DeleteMapping(ApiPaths.SEG_SCHEDULES + ApiPaths.SEG_SCHEDULE_ID)
    public ApiResponse<Void> deleteSchedule(@PathVariable Long id) {
        scheduleService.deleteSchedule(id);
        return ApiResponse.ok(null);
    }

    @PatchMapping(ApiPaths.SEG_SCHEDULES + ApiPaths.SEG_SCHEDULE_ACTIVE)
    public ApiResponse<ScheduleDetailResponse> toggleScheduleActive(
            @PathVariable Long id,
            @RequestParam boolean isActive) {
        return ApiResponse.ok(scheduleService.toggleScheduleActive(id, isActive));
    }
}
