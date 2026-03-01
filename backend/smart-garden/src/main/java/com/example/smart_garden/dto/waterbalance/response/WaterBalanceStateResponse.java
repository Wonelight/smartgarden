package com.example.smart_garden.dto.waterbalance.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Response chứa water balance state của device và các biến lag đã tính.
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
        LocalDateTime lastUpdated,
        // Lag features (tính từ depletion_history + sensor data)
        Float depletionTrend6h,
        Float depletionTrend12h,
        Float depletionTrend24h,
        Float rainLast6h,
        Float rainLast12h,
        Float rainLast24h,
        Float etcRolling6h,
        Float etcRolling12h,
        Float etcRolling24h
) {
}
