import { apiClient } from './client';
import type { ApiResponse } from '../types';

// ── Types ─────────────────────────────────────────────

export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface Detection {
    label: string;
    confidence: number;
    bbox: BoundingBox;
}

export interface Classification {
    label: string;
    confidence: number;
}

export interface PlantHealthSummary {
    status: string;
    healthScore: number;
    diseaseNames: string[];
    pestNames: string[];
    affectedAreaPct: number;
    recommendation: string;
}

export interface PlantAnalyzeResponse {
    deviceId: number;
    task: string;
    detections: Detection[];
    classifications: Classification[];
    segments: unknown[];
    summary: PlantHealthSummary;
    inferenceMs: number;
}

export interface CameraCaptureResponse {
    analysis: PlantAnalyzeResponse;
    annotatedImageBase64: string;
}

export interface CameraStatusResponse {
    cameraAvailable: boolean;
    source: number;
    modelLoaded: boolean;
    resolution: { width: number; height: number } | null;
    fps: number | null;
}

// ── Request types ─────────────────────────────────────

export interface PlantAnalyzeRequest {
    deviceId?: number;
    imageBase64: string;
    task?: 'detect' | 'classify' | 'segment';
    confidenceThreshold?: number;
}

export interface CameraCaptureRequest {
    deviceId?: number;
    confidence?: number;
}

// ── API URL for AI service (direct connection for MJPEG stream) ──
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:5000';

const ANALYZE_TIMEOUT = 30000;

// ── API Client ────────────────────────────────────────

export const plantApi = {
    /**
     * Gửi ảnh base64 để phân tích bệnh cây.
     * Goes through backend proxy (authenticated).
     */
    analyze: async (request: PlantAnalyzeRequest): Promise<PlantAnalyzeResponse> => {
        const response = await apiClient.post<ApiResponse<PlantAnalyzeResponse>>(
            '/plant/analyze',
            request,
            { timeout: ANALYZE_TIMEOUT },
        );
        return response.data.data!;
    },

    /**
     * Chụp 1 frame từ camera server-side, chạy YOLO.
     * Goes through backend proxy.
     */
    cameraCapture: async (request?: CameraCaptureRequest): Promise<CameraCaptureResponse> => {
        const response = await apiClient.post<ApiResponse<CameraCaptureResponse>>(
            '/plant/camera/capture',
            request ?? { deviceId: 0, confidence: 0.25 },
            { timeout: ANALYZE_TIMEOUT },
        );
        return response.data.data!;
    },

    /**
     * Lấy trạng thái camera.
     */
    cameraStatus: async (): Promise<CameraStatusResponse> => {
        const response = await apiClient.get<ApiResponse<CameraStatusResponse>>(
            '/plant/camera/status',
        );
        return response.data.data!;
    },

    /**
     * Mở camera (source = 0 default).
     */
    cameraOpen: async (source: number = 0): Promise<void> => {
        await apiClient.post('/plant/camera/open', null, {
            params: { source },
        });
    },

    /**
     * Đóng camera.
     */
    cameraClose: async (): Promise<void> => {
        await apiClient.post('/plant/camera/close');
    },

    /**
     * URL cho MJPEG stream — dùng trực tiếp trong <img src="...">
     * Points directly to AI service (no proxy needed for streaming).
     */
    getCameraStreamUrl: (options?: {
        detect?: boolean;
        confidence?: number;
        fps?: number;
        source?: number;
    }): string => {
        const { detect = true, confidence = 0.25, fps = 10, source = 0 } = options ?? {};
        return `${AI_SERVICE_URL}/plant/camera/stream?detect=${detect}&confidence=${confidence}&fps=${fps}&source=${source}`;
    },
};
