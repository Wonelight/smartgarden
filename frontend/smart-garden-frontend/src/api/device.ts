import { apiClient } from './client';
import type { ApiResponse } from '../types';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface UserDeviceListItem {
    id: number;
    deviceName: string;
    deviceCode: string;
    location: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    status: DeviceStatus;
    lastOnline: string | null;
    // Garden area bounds (optional - for map highlighting)
    gardenBounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    gardenArea?: number; // in square meters
    defaultCropId?: number;
    defaultSoilId?: number;
}

export interface UserDeviceDetail extends UserDeviceListItem {
    firmwareVersion: string | null;
}

export interface AdminDeviceListItem {
    id: number;
    deviceCode: string;
    deviceName: string;
    location: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    status: DeviceStatus;
    firmwareVersion: string | null;
    lastOnline: string | null;
    userId: number | null;
    username: string | null;
}

export interface AdminDeviceDetail extends AdminDeviceListItem {
    createdAt: string;
    updatedAt: string;
}

export interface AdminCreateDeviceRequest {
    deviceCode: string;
    deviceName: string;
    userId?: number | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
}

export interface AdminUpdateDeviceRequest {
    deviceName?: string;
    userId?: number | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    status?: DeviceStatus;
    firmwareVersion?: string | null;
}

export const deviceApi = {
    getMyDevices: async (): Promise<UserDeviceListItem[]> => {
        const response = await apiClient.get<ApiResponse<UserDeviceListItem[]>>('/devices');
        return response.data.data ?? [];
    },

    getMyDeviceById: async (id: number): Promise<UserDeviceDetail> => {
        const response = await apiClient.get<ApiResponse<UserDeviceDetail>>(`/devices/${id}`);
        return response.data.data;
    },

    updateMyDevice: async (
        id: number,
        payload: {
            deviceName?: string;
            location?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            altitude?: number | null;
        }
    ): Promise<UserDeviceDetail> => {
        const response = await apiClient.put<ApiResponse<UserDeviceDetail>>(`/devices/${id}`, payload);
        return response.data.data;
    },

    /** Kết nối vườn với thiết bị ESP32 bằng địa chỉ MAC (hiển thị trên màn hình ESP32). */
    connectDevice: async (macAddress: string): Promise<UserDeviceDetail> => {
        const response = await apiClient.post<ApiResponse<UserDeviceDetail>>('/devices/connect', {
            macAddress: macAddress.trim(),
        });
        return response.data.data;
    },

    /** Ngắt kết nối thiết bị khỏi tài khoản (thiết bị vẫn tồn tại, có thể kết nối lại sau). */
    disconnectMyDevice: async (id: number): Promise<void> => {
        await apiClient.delete(`/devices/${id}`);
    },

    /** Xóa thiết bị (soft delete) – chỉ với thiết bị do mình sở hữu. */
    deleteMyDevice: async (id: number): Promise<void> => {
        await apiClient.post(`/devices/${id}/delete`);
    },

    adminGetAllDevices: async (): Promise<AdminDeviceListItem[]> => {
        const response = await apiClient.get<ApiResponse<AdminDeviceListItem[]>>('/admin/devices');
        return response.data.data ?? [];
    },

    adminGetDeviceById: async (id: number): Promise<AdminDeviceDetail> => {
        const response = await apiClient.get<ApiResponse<AdminDeviceDetail>>(`/admin/devices/${id}`);
        return response.data.data;
    },

    adminCreateDevice: async (payload: AdminCreateDeviceRequest): Promise<AdminDeviceDetail> => {
        const response = await apiClient.post<ApiResponse<AdminDeviceDetail>>('/admin/devices', payload);
        return response.data.data;
    },

    adminUpdateDevice: async (id: number, payload: AdminUpdateDeviceRequest): Promise<AdminDeviceDetail> => {
        const response = await apiClient.put<ApiResponse<AdminDeviceDetail>>(`/admin/devices/${id}`, payload);
        return response.data.data;
    },

    adminDeleteDevice: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/devices/${id}`);
    },

    sendControlCommand: async (
        deviceId: number,
        controlType: 'PUMP' | 'LED' | 'SYSTEM',
        action: 'ON' | 'OFF' | 'TOGGLE',
        duration?: number
    ): Promise<any> => {
        const response = await apiClient.post<ApiResponse<any>>('/devices/controls', {
            deviceId,
            controlType,
            action,
            duration,
        });
        return response.data.data;
    },
    saveGardenConfig: async (
        deviceId: number,
        payload: {
            gardenArea?: number;
            defaultCropId?: number;
            defaultSoilId?: number;
        }
    ): Promise<UserDeviceDetail> => {
        const responseData = await apiClient.put<ApiResponse<UserDeviceDetail>>(`/devices/${deviceId}`, payload);
        return responseData.data.data;
    },
};

