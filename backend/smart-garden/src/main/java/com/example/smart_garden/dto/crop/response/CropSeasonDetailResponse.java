package com.example.smart_garden.dto.crop.response;

import java.time.LocalDate;

public record CropSeasonDetailResponse(
        Long id,
        Long deviceId,
        Long cropId,
        String cropName,
        Long soilId,
        String soilName,
        LocalDate startDate,
        String status,
        Float initialRootDepth,
        Float infiltrationShallowRatio) {
}
