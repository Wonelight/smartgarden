import { apiClient } from './client';
import type {
    RegisterRequest,
    RegisterResponse,
    ApiResponse,
    UserProfile,
    UpdateProfileRequest,
    ChangePasswordRequest,
    AdminUserListItem,
    AdminUserDetail,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
} from '../types';

export const userApi = {
    // ================== PUBLIC ==================
    register: async (body: RegisterRequest): Promise<RegisterResponse> => {
        const response = await apiClient.post<ApiResponse<RegisterResponse>>(
            '/users/register',
            body
        );
        return response.data.data;
    },

    // ================== SELF (User) ==================
    getMyProfile: async (): Promise<UserProfile> => {
        const response = await apiClient.get<ApiResponse<UserProfile>>('/users/me');
        return response.data.data;
    },

    updateMyProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
        const response = await apiClient.put<ApiResponse<UserProfile>>('/users/me', data);
        return response.data.data;
    },

    changePassword: async (data: ChangePasswordRequest): Promise<void> => {
        await apiClient.post('/users/me/change-password', data);
    },

    // ================== ADMIN ==================
    adminGetAllUsers: async (): Promise<AdminUserListItem[]> => {
        const response = await apiClient.get<ApiResponse<AdminUserListItem[]>>('/admin/users');
        return response.data.data;
    },

    adminGetUserById: async (id: number): Promise<AdminUserDetail> => {
        const response = await apiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`);
        return response.data.data;
    },

    adminCreateUser: async (data: AdminCreateUserRequest): Promise<AdminUserDetail> => {
        const response = await apiClient.post<ApiResponse<AdminUserDetail>>('/admin/users', data);
        return response.data.data;
    },

    adminUpdateUser: async (id: number, data: AdminUpdateUserRequest): Promise<AdminUserDetail> => {
        const response = await apiClient.put<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`, data);
        return response.data.data;
    },

    adminDeleteUser: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/users/${id}`);
    },
};

