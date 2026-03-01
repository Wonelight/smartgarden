import { apiClient } from './client';
import type { ApiResponse } from '../types';

export interface WaterBalanceStateResponse {
    deviceId: number;
    shallowDepletion: number;
    deepDepletion: number;
    shallowTaw: number;
    deepTaw: number;
    shallowRaw: number;
    deepRaw: number;
    weightedDepletion: number;
    totalTaw: number;
    totalRaw: number;
    lastIrrigation: number;
    soilMoisHistory: Array<Record<string, unknown>> | null;
    soilMoisTrend: number | null;
    lastUpdated: string;
}

export interface DailyWaterBalanceResponse {
    id: number;
    seasonId: number;
    date: string;
    cropAge: number;
    et0Value: number | null;
    kcCurrent: number | null;
    etcValue: number | null;
    effectiveRain: number | null;
    irrigationAmount: number | null;
    dcValue: number | null;
    recommendation: string | null;
}

export const waterBalanceApi = {
    getWaterBalanceState: async (deviceId: number): Promise<WaterBalanceStateResponse> => {
        const response = await apiClient.get<ApiResponse<WaterBalanceStateResponse>>(
            `/devices/${deviceId}/water-balance-state`
        );
        return response.data.data!;
    },
};
