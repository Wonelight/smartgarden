import { apiClient } from './client';
import type { ApiResponse } from '../types';
import type { PageResponse } from './sensor';
import type { LogLevel, LogSource } from '../types/dashboard';

export interface SystemLogItem {
    id: number;
    logLevel: LogLevel;
    logSource: LogSource;
    deviceId: number | null;
    deviceName: string | null;
    message: string;
    stackTrace: string | null;
    createdAt: string;
}

export interface LogFilterParams {
    page?: number;
    size?: number;
    level?: LogLevel | null;
    source?: LogSource | null;
}

export const logsApi = {
    /** Lấy logs của thiết bị thuộc về user hiện tại */
    getMyLogs: async (params: LogFilterParams = {}): Promise<PageResponse<SystemLogItem>> => {
        const { page = 0, size = 20, level, source } = params;
        const query: Record<string, unknown> = { page, size };
        if (level) query.level = level;
        if (source) query.source = source;
        const response = await apiClient.get<ApiResponse<PageResponse<SystemLogItem>>>('/logs', {
            params: query,
        });
        return response.data.data!;
    },

    /** Admin: lấy toàn bộ logs hệ thống */
    adminGetAllLogs: async (params: LogFilterParams = {}): Promise<PageResponse<SystemLogItem>> => {
        const { page = 0, size = 50, level, source } = params;
        const query: Record<string, unknown> = { page, size };
        if (level) query.level = level;
        if (source) query.source = source;
        const response = await apiClient.get<ApiResponse<PageResponse<SystemLogItem>>>('/admin/logs', {
            params: query,
        });
        return response.data.data!;
    },
};
