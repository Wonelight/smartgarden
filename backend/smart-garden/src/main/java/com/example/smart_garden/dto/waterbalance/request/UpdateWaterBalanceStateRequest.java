package com.example.smart_garden.dto.waterbalance.request;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

/**
 * Request để cập nhật water balance state cho device.
 * Được gọi từ AI service sau mỗi prediction cycle.
 */
public record UpdateWaterBalanceStateRequest(
        @NotNull Float shallowDepletion,
        @NotNull Float deepDepletion,
        @NotNull Float shallowTaw,
        @NotNull Float deepTaw,
        @NotNull Float shallowRaw,
        @NotNull Float deepRaw,
        Float lastIrrigation,
        Float soilMoisAvg,
        List<Map<String, Object>> soilMoisHistory
) {
}
