import { apiClient } from './client';
import type { ApiResponse } from '../types';
import type { PageResponse } from './sensor'; // PageResponse<T> from sensor API

export interface IrrigationConfigDetailResponse {
    id: number;
    deviceId: number;
    soilMoistureMin: number | null;
    soilMoistureMax: number | null;
    soilMoistureOptimal: number | null;
    tempMin: number | null;
    tempMax: number | null;
    lightThreshold: number | null;
    irrigationDurationMin: number | null;
    irrigationDurationMax: number | null;
    fuzzyEnabled: boolean | null;
    autoMode: boolean | null;
    aiEnabled: boolean | null;
    updatedAt: string | null;
}

export interface IrrigationHistoryListItemResponse {
    id: number;
    deviceId: number;
    irrigationMode: string;
    duration: number | null;
    waterVolume: number | null;
    startTime: string;
    endTime: string | null;
    status: string;
}

export interface UserPartialUpdateIrrigationConfigRequest {
    soilMoistureMin?: number;
    soilMoistureMax?: number;
    soilMoistureOptimal?: number;
    tempMin?: number;
    tempMax?: number;
    lightThreshold?: number;
    irrigationDurationMin?: number;
    irrigationDurationMax?: number;
    fuzzyEnabled?: boolean;
    autoMode?: boolean;
}

export const irrigationApi = {
    getConfigByDeviceId: async (deviceId: number): Promise<IrrigationConfigDetailResponse> => {
        const response = await apiClient.get<ApiResponse<IrrigationConfigDetailResponse>>(
            `/devices/${deviceId}/irrigation/config`
        );
        return response.data.data!;
    },

    userUpdateConfig: async (
        deviceId: number,
        payload: UserPartialUpdateIrrigationConfigRequest
    ): Promise<IrrigationConfigDetailResponse> => {
        const response = await apiClient.put<ApiResponse<IrrigationConfigDetailResponse>>(
            `/devices/${deviceId}/irrigation/config`,
            payload
        );
        return response.data.data!;
    },

    getHistoryByDeviceId: async (
        deviceId: number,
        page = 0,
        size = 20
    ): Promise<PageResponse<IrrigationHistoryListItemResponse>> => {
        const response = await apiClient.get<
            ApiResponse<PageResponse<IrrigationHistoryListItemResponse>>
        >(`/devices/${deviceId}/irrigation/history`, { params: { page, size } });
        return response.data.data!;
    },

    getHistoryByTimeRange: async (
        deviceId: number,
        startTime: string,
        endTime: string
    ): Promise<IrrigationHistoryListItemResponse[]> => {
        const response = await apiClient.get<ApiResponse<IrrigationHistoryListItemResponse[]>>(
            `/devices/${deviceId}/irrigation/history/range`,
            { params: { startTime, endTime } }
        );
        return response.data.data ?? [];
    },
};
