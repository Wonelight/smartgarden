package com.example.smart_garden.service;

import com.example.smart_garden.dto.crop.request.CropSeasonCreateRequest;
import com.example.smart_garden.dto.crop.response.CropRecommendationResponse;
import com.example.smart_garden.dto.crop.response.CropSeasonDetailResponse;

import java.util.List;

public interface CropSeasonService {

    /**
     * Get the active crop season for a device.
     */
    CropSeasonDetailResponse getActiveSeason(Long deviceId);

    /**
     * Start a new crop season for a device. Ends any currently active season first.
     */
    CropSeasonDetailResponse startNewSeason(Long deviceId, CropSeasonCreateRequest request);

    /**
     * End the current active season for a device.
     */
    void endActiveSeason(Long deviceId);

    /**
     * Recommend crops based on the device's current weather and location.
     */
    List<CropRecommendationResponse> getRecommendations(Long deviceId);
}
