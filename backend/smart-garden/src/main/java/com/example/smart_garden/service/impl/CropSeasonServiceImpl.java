package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.crop.request.CropSeasonCreateRequest;
import com.example.smart_garden.dto.crop.response.CropRecommendationResponse;
import com.example.smart_garden.dto.crop.response.CropSeasonDetailResponse;
import com.example.smart_garden.dto.monitoring.response.WeatherDataDetailResponse;
import com.example.smart_garden.entity.CropLibrary;
import com.example.smart_garden.entity.CropSeason;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.SoilLibrary;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.CropLibraryRepository;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.SoilLibraryRepository;
import com.example.smart_garden.service.CropSeasonService;
import com.example.smart_garden.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CropSeasonServiceImpl implements CropSeasonService {

    private final CropSeasonRepository cropSeasonRepository;
    private final DeviceRepository deviceRepository;
    private final CropLibraryRepository cropLibraryRepository;
    private final SoilLibraryRepository soilLibraryRepository;
    private final WeatherService weatherService;

    @Override
    public CropSeasonDetailResponse getActiveSeason(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        return cropSeasonRepository.findByDeviceIdAndStatus(device.getId(), CropSeasonStatus.ACTIVE)
                .map(this::toDetailResponse)
                .orElse(null);
    }

    @Override
    @Transactional
    public CropSeasonDetailResponse startNewSeason(Long deviceId, CropSeasonCreateRequest request) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        CropLibrary crop = cropLibraryRepository.findById(request.cropId())
                .orElseThrow(() -> new AppException(ErrorCode.CROP_NOT_FOUND));

        SoilLibrary soil = soilLibraryRepository.findById(request.soilId())
                .orElseThrow(() -> new AppException(ErrorCode.SOIL_NOT_FOUND));

        // Disable existing active season if any
        cropSeasonRepository.findByDeviceIdAndStatus(device.getId(), CropSeasonStatus.ACTIVE)
                .ifPresent(existing -> {
                    existing.setStatus(CropSeasonStatus.COMPLETED);
                    cropSeasonRepository.save(existing);
                });

        CropSeason newSeason = new CropSeason();
        newSeason.setDevice(device);
        newSeason.setCrop(crop);
        newSeason.setSoil(soil);
        newSeason.setStartDate(request.startDate());
        newSeason.setStatus(CropSeasonStatus.ACTIVE);

        // Expected end date
        int totalDays = crop.getStageIniDays() + crop.getStageDevDays() + crop.getStageMidDays()
                + crop.getStageEndDays();

        // Use requested initial root depth or default 0.1m
        newSeason.setInitialRootDepth(request.initialRootDepth() != null ? request.initialRootDepth() : 0.1f);

        // Use requested infiltration ratio or soil default
        newSeason.setInfiltrationShallowRatio(request.infiltrationShallowRatio() != null
                ? request.infiltrationShallowRatio()
                : soil.getInfiltrationShallowRatio());

        CropSeason saved = cropSeasonRepository.save(newSeason);
        log.info("Started new crop season {} for device {}", saved.getId(), device.getId());
        return toDetailResponse(saved);
    }

    @Override
    @Transactional
    public void endActiveSeason(Long deviceId) {
        CropSeason activeSeason = cropSeasonRepository.findByDeviceIdAndStatus(deviceId, CropSeasonStatus.ACTIVE)
                .orElseThrow(() -> new AppException(ErrorCode.CROP_SEASON_NOT_FOUND));

        activeSeason.setStatus(CropSeasonStatus.COMPLETED);
        cropSeasonRepository.save(activeSeason);
        log.info("Ended crop season {} for device {}", activeSeason.getId(), deviceId);
    }

    @Override
    public List<CropRecommendationResponse> getRecommendations(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        List<CropLibrary> allCrops = cropLibraryRepository.findAll();
        List<CropRecommendationResponse> recommendations = new ArrayList<>();

        // Extract weather context for recommendation
        String location = device.getLocation();

        if (location == null || location.isEmpty()) {
            return fallbackRecommendations(allCrops);
        }

        try {
            WeatherDataDetailResponse weather = weatherService.getCurrentWeather(location);
            if (weather == null)
                return fallbackRecommendations(allCrops);

            // Basic recommendation logic based on current temperature
            Float temp = weather.temperature();
            String seasonContext = temp > 32 ? "trời nắng nóng" : temp < 20 ? "trời mát/lạnh" : "thời tiết ôn hòa";

            for (CropLibrary crop : allCrops) {
                String name = crop.getName().toLowerCase();
                String reason;
                Float score = 0.5f;

                // Simple pseudo-intelligence for Demo mapping
                if (temp > 32) {
                    if (name.contains("dưa") || name.contains("ớt") || name.contains("lúa")) {
                        reason = String.format("Thích nghi tốt với %s (%.1f°C), chịu hạn tốt.", seasonContext, temp);
                        score = 0.9f;
                    } else {
                        reason = "Cần chú ý lượng nước tưới bổ sung.";
                        score = 0.6f;
                    }
                } else if (temp < 20) {
                    if (name.contains("cải") || name.contains("cà chua") || name.contains("su hào")
                            || name.contains("dâu tây")) {
                        reason = String.format("Phát triển mạnh trong %s (%.1f°C).", seasonContext, temp);
                        score = 0.9f;
                    } else {
                        reason = "Cần che chắn khi nhiệt độ xuống thấp.";
                        score = 0.5f;
                    }
                } else {
                    if (name.contains("đậu") || name.contains("ngô") || name.contains("hành")) {
                        reason = "Rất phù hợp trong " + seasonContext;
                        score = 0.85f;
                    } else {
                        reason = "Có thể trồng trong điều kiện tự nhiên hiện tại.";
                        score = 0.7f;
                    }
                }

                recommendations.add(new CropRecommendationResponse(crop.getId(), crop.getName(), reason, score));
            }

            // Sort by score descending
            recommendations.sort((a, b) -> Float.compare(b.matchScore(), a.matchScore()));

        } catch (Exception e) {
            log.warn("Failed to get weather recommendations for device {}: {}", deviceId, e.getMessage());
            return fallbackRecommendations(allCrops);
        }

        return recommendations;
    }

    private List<CropRecommendationResponse> fallbackRecommendations(List<CropLibrary> crops) {
        return crops.stream()
                .map(c -> new CropRecommendationResponse(c.getId(), c.getName(), "Lựa chọn phổ biến", 0.5f))
                .toList();
    }

    private CropSeasonDetailResponse toDetailResponse(CropSeason season) {
        return new CropSeasonDetailResponse(
                season.getId(),
                season.getDevice().getId(),
                season.getCrop().getId(),
                season.getCrop().getName(),
                season.getSoil().getId(),
                season.getSoil().getName(),
                season.getStartDate(),
                season.getStatus().name(),
                season.getInitialRootDepth(),
                season.getInfiltrationShallowRatio());
    }
}
