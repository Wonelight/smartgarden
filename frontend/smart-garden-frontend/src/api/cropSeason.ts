import { apiClient as api } from './client';
import type { ApiResponse } from '../types';

export interface CropSeasonDetailResponse {
    id: number;
    deviceId: number;
    cropId: number;
    cropName: string;
    soilId: number;
    soilName: string;
    startDate: string;
    status: string;
    initialRootDepth: number;
    infiltrationShallowRatio: number;
}

export interface CropSeasonCreateRequest {
    cropId: number;
    soilId: number;
    startDate: string;
}

export interface CropRecommendationResponse {
    cropId: number;
    cropName: string;
    reason: string;
    matchScore: number;
}

export const cropSeasonApi = {
    getActiveSeason: async (deviceId: number): Promise<CropSeasonDetailResponse | null> => {
        try {
            const response = await api.get<ApiResponse<CropSeasonDetailResponse | null>>(`/crop-season/device/${deviceId}/active`);
            return response.data.data || null;
        } catch (error: any) {
            // Return null if season doesn't exist (e.g., 404 or backend returns empty data)
            return null;
        }
    },

    startNewSeason: async (deviceId: number, request: CropSeasonCreateRequest): Promise<CropSeasonDetailResponse> => {
        const response = await api.post<ApiResponse<CropSeasonDetailResponse>>(`/crop-season/device/${deviceId}`, request);
        return response.data.data as CropSeasonDetailResponse;
    },

    endActiveSeason: async (deviceId: number): Promise<void> => {
        await api.put(`/crop-season/device/${deviceId}/end`);
    },

    getRecommendations: async (deviceId: number): Promise<CropRecommendationResponse[]> => {
        const response = await api.get<ApiResponse<CropRecommendationResponse[]>>(`/crop-season/device/${deviceId}/recommendations`);
        return response.data.data ?? [];
    }
};
