package com.example.smart_garden.dto.waterbalance.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Response chứa water balance state của device.
 */
public record WaterBalanceStateResponse(
        Long deviceId,
        Float shallowDepletion,
        Float deepDepletion,
        Float shallowTaw,
        Float deepTaw,
        Float shallowRaw,
        Float deepRaw,
        Float weightedDepletion,
        Float totalTaw,
        Float totalRaw,
        Float lastIrrigation,
        List<Map<String, Object>> soilMoisHistory,
        Float soilMoisTrend,
        LocalDateTime lastUpdated
) {
}
