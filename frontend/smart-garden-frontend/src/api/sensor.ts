import { apiClient } from './client';
import type { ApiResponse } from '../types';

export interface PageResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface SensorDataDetailResponse {
    id: number;
    deviceId: number;
    soilMoisture: number | null;
    temperature: number | null;
    humidity: number | null;
    lightIntensity: number | null;
    rainDetected: boolean | null;
    ambientLight: number | null;
    timestamp: string;
}

export interface SensorDataListItemResponse {
    id: number;
    soilMoisture: number | null;
    temperature: number | null;
    humidity: number | null;
    lightIntensity: number | null;
    rainDetected: boolean | null;
    ambientLight: number | null;
    timestamp: string;
}

export const sensorApi = {
    getLatestByDeviceId: async (deviceId: number): Promise<SensorDataDetailResponse> => {
        const response = await apiClient.get<ApiResponse<SensorDataDetailResponse>>(
            `/devices/${deviceId}/sensor-data/latest`
        );
        return response.data.data!;
    },

    getByDeviceId: async (
        deviceId: number,
        page = 0,
        size = 20
    ): Promise<PageResponse<SensorDataListItemResponse>> => {
        const response = await apiClient.get<ApiResponse<PageResponse<SensorDataListItemResponse>>>(
            `/devices/${deviceId}/sensor-data`,
            { params: { page, size } }
        );
        return response.data.data!;
    },

    getByDeviceIdAndTimeRange: async (
        deviceId: number,
        startTime: string,
        endTime: string
    ): Promise<SensorDataListItemResponse[]> => {
        const response = await apiClient.get<ApiResponse<SensorDataListItemResponse[]>>(
            `/devices/${deviceId}/sensor-data/range`,
            { params: { startTime, endTime } }
        );
        return response.data.data ?? [];
    },
};
