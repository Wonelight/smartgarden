import { apiClient } from './client';
import type { ApiResponse } from '../types';

/** Request body for triggering AI prediction */
export interface AiPredictRequest {
    deviceId: number;
    sensorDataId?: number | null;
}

/** Response from AI prediction (immediate) */
export interface AiPredictResponse {
    predictionId: number | null;
    deviceId: number;
    predictedDuration: number | null;
    aiOutput: number | null;
    confidence: number | null;
    refinedDuration: number | null;
    createdAt: string | null;
}

/** Latest ML prediction detail (from GET /ai/results/{deviceId}) */
export interface MlPredictionDetailResponse {
    id: number;
    deviceId: number;
    predictionType: string;
    predictedWaterAmount: number | null;
    predictedDuration: number | null;
    predictionHorizon: number | null;
    modelAccuracy: number | null;
    featuresUsed: Record<string, unknown> | null;
    aiOutput: number | null;
    aiParams: Record<string, unknown> | null;
    aiAccuracy: number | null;
    createdAt: string;
}

/** Timeout cho predict (backend gọi ai-service có thể mất ~60s) */
const PREDICT_TIMEOUT_MS = 65000;

export const aiApi = {
    /** Trigger AI prediction for a device using latest sensor data */
    predict: async (payload: AiPredictRequest): Promise<AiPredictResponse> => {
        const response = await apiClient.post<ApiResponse<AiPredictResponse>>('/ai/predict', payload, {
            timeout: PREDICT_TIMEOUT_MS,
        });
        return response.data.data!;
    },

    /** Get latest AI/ML prediction result for a device */
    getLatestResult: async (deviceId: number): Promise<MlPredictionDetailResponse> => {
        const response = await apiClient.get<ApiResponse<MlPredictionDetailResponse>>(
            `/ai/results/${deviceId}`
        );
        return response.data.data!;
    },

    /** Get history of AI/ML prediction results for a device */
    getHistory: async (deviceId: number): Promise<MlPredictionDetailResponse[]> => {
        const response = await apiClient.get<ApiResponse<MlPredictionDetailResponse[]>>(
            `/ai/results/history/${deviceId}`
        );
        return response.data.data!;
    },
};
