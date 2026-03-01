import { apiClient } from './client';
import type { ApiResponse } from '../types';

export interface SoilLibraryListItem {
    id: number;
    name: string;
    fieldCapacity: number;
    wiltingPoint: number;
    infiltrationShallowRatio: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface SoilLibraryDetail extends SoilLibraryListItem {}

export interface AdminCreateSoilLibraryRequest {
    name: string;
    fieldCapacity: number;
    wiltingPoint: number;
    infiltrationShallowRatio?: number | null;
}

export interface AdminUpdateSoilLibraryRequest {
    name?: string;
    fieldCapacity?: number;
    wiltingPoint?: number;
    infiltrationShallowRatio?: number | null;
}

export const soilApi = {
    adminGetAllSoilLibraries: async (): Promise<SoilLibraryListItem[]> => {
        const response = await apiClient.get<ApiResponse<SoilLibraryListItem[]>>('/admin/soil-libraries');
        return response.data.data ?? [];
    },

    adminGetSoilLibraryById: async (id: number): Promise<SoilLibraryDetail> => {
        const response = await apiClient.get<ApiResponse<SoilLibraryDetail>>(`/admin/soil-libraries/${id}`);
        return response.data.data;
    },

    adminCreateSoilLibrary: async (payload: AdminCreateSoilLibraryRequest): Promise<SoilLibraryDetail> => {
        const response = await apiClient.post<ApiResponse<SoilLibraryDetail>>('/admin/soil-libraries', payload);
        return response.data.data;
    },

    adminUpdateSoilLibrary: async (id: number, payload: AdminUpdateSoilLibraryRequest): Promise<SoilLibraryDetail> => {
        const response = await apiClient.put<ApiResponse<SoilLibraryDetail>>(`/admin/soil-libraries/${id}`, payload);
        return response.data.data;
    },

    adminDeleteSoilLibrary: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/soil-libraries/${id}`);
    },
};
