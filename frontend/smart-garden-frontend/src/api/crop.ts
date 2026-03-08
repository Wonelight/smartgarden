import { apiClient } from './client';
import type { ApiResponse } from '../types';

export interface CropLibraryListItem {
    id: number;
    name: string;
    kcIni: number;
    kcMid: number;
    kcEnd: number;
    stageIniDays: number;
    stageDevDays: number;
    stageMidDays: number;
    stageEndDays: number;
    maxRootDepth: number;
    depletionFraction: number;
    createdAt: string;
    updatedAt: string;
}

export interface CropLibraryDetail extends CropLibraryListItem {
}

export interface AdminCreateCropLibraryRequest {
    name: string;
    kcIni: number;
    kcMid: number;
    kcEnd: number;
    stageIniDays: number;
    stageDevDays: number;
    stageMidDays: number;
    stageEndDays: number;
    maxRootDepth: number;
    depletionFraction: number;
}

export interface AdminUpdateCropLibraryRequest {
    name?: string;
    kcIni?: number;
    kcMid?: number;
    kcEnd?: number;
    stageIniDays?: number;
    stageDevDays?: number;
    stageMidDays?: number;
    stageEndDays?: number;
    maxRootDepth?: number;
    depletionFraction?: number;
}

export const cropApi = {
    adminGetAllCropLibraries: async (): Promise<CropLibraryListItem[]> => {
        const response = await apiClient.get<ApiResponse<CropLibraryListItem[]>>('/admin/crop-libraries');
        return response.data.data ?? [];
    },

    getAllCropLibraries: async (): Promise<CropLibraryListItem[]> => {
        const response = await apiClient.get<ApiResponse<CropLibraryListItem[]>>('/crop-libraries');
        return response.data.data ?? [];
    },

    adminGetCropLibraryById: async (id: number): Promise<CropLibraryDetail> => {
        const response = await apiClient.get<ApiResponse<CropLibraryDetail>>(`/admin/crop-libraries/${id}`);
        return response.data.data;
    },

    adminCreateCropLibrary: async (payload: AdminCreateCropLibraryRequest): Promise<CropLibraryDetail> => {
        const response = await apiClient.post<ApiResponse<CropLibraryDetail>>('/admin/crop-libraries', payload);
        return response.data.data;
    },

    adminUpdateCropLibrary: async (id: number, payload: AdminUpdateCropLibraryRequest): Promise<CropLibraryDetail> => {
        const response = await apiClient.put<ApiResponse<CropLibraryDetail>>(`/admin/crop-libraries/${id}`, payload);
        return response.data.data;
    },

    adminDeleteCropLibrary: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/crop-libraries/${id}`);
    },
};
