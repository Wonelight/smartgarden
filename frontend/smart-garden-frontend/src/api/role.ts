import { apiClient } from './client';
import type { ApiResponse } from '../types';
import type { RoleListItem } from '../types/user';

export const roleApi = {
    getAllRoles: async (): Promise<RoleListItem[]> => {
        const response = await apiClient.get<ApiResponse<RoleListItem[]>>('/v1/roles');
        return response.data.data ?? [];
    },
};
