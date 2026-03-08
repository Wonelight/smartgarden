import { apiClient } from './client';
import type { ApiResponse } from '../types';
import type { PageResponse } from './sensor';

export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
export type NotificationCategory = 'SOIL' | 'DEVICE' | 'IRRIGATION' | 'SYSTEM';

export interface NotificationItem {
    id: number;
    type: NotificationType;
    category: NotificationCategory;
    deviceId: number | null;
    deviceName: string | null;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

export interface NotificationFilterParams {
    page?: number;
    size?: number;
    category?: NotificationCategory;
}

export const notificationsApi = {
    getMyNotifications: async (params: NotificationFilterParams = {}): Promise<PageResponse<NotificationItem>> => {
        const response = await apiClient.get<ApiResponse<PageResponse<NotificationItem>>>('/notifications', {
            params: {
                page: params.page ?? 0,
                size: params.size ?? 20,
                ...(params.category ? { category: params.category } : {}),
            },
        });
        return response.data.data;
    },

    countUnread: async (): Promise<number> => {
        const response = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
        return response.data.data.count;
    },

    markAsRead: async (id: number): Promise<void> => {
        await apiClient.patch(`/notifications/${id}/read`);
    },

    markAllAsRead: async (): Promise<void> => {
        await apiClient.post('/notifications/read-all');
    },
};
