package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.monitoring.response.WeatherDataDetailResponse;
import com.example.smart_garden.dto.weather.response.DailyWeatherForecastResponse;
import com.example.smart_garden.service.WeatherService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(ApiPaths.BASE + "/weather")
@RequiredArgsConstructor
@Tag(name = "Weather Controller", description = "Quản lý dữ liệu thời tiết")
public class WeatherController {

    private final WeatherService weatherService;

    @Operation(summary = "Lấy danh sách các địa điểm đang được theo dõi")
    @GetMapping("/locations")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<Map<String, Integer>> getMonitoredLocations() {
        return ApiResponse.ok(weatherService.getMonitoredLocations());
    }

    @Operation(summary = "Kích hoạt lấy dữ liệu thời tiết ngay lập tức (Admin)")
    @PostMapping("/fetch-now")
    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    public ApiResponse<String> fetchWeatherNow() {
        weatherService.fetchWeatherForAllDevices();
        return ApiResponse.ok("Đã gửi lệnh cập nhật thời tiết.");
    }

    @Operation(summary = "Lấy dữ liệu thời tiết cho một thiết bị cụ thể")
    @PostMapping("/device/{deviceId}/fetch")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<String> fetchWeatherForDevice(@PathVariable Long deviceId) {
        weatherService.fetchWeatherForDevice(deviceId);
        return ApiResponse.ok("Đã cập nhật thời tiết cho thiết bị.");
    }

    @Operation(summary = "Lấy thời tiết hiện tại cho một địa điểm")
    @GetMapping("/current/{location}")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<WeatherDataDetailResponse> getCurrentWeather(@PathVariable String location) {
        WeatherDataDetailResponse weather = weatherService.getCurrentWeather(location);
        return ApiResponse.ok(weather);
    }

    @Operation(summary = "Lấy dự báo thời tiết 5 ngày cho một địa điểm")
    @GetMapping("/forecast/{location}")
    @PreAuthorize("hasAnyRole(T(com.example.smart_garden.security.RbacRoles).ADMIN, T(com.example.smart_garden.security.RbacRoles).USER)")
    public ApiResponse<List<DailyWeatherForecastResponse>> getWeatherForecast(@PathVariable String location) {
        List<DailyWeatherForecastResponse> forecast = weatherService.getWeatherForecast(location);
        return ApiResponse.ok(forecast);
    }
}
