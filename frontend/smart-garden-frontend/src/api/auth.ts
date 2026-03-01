import axios from 'axios';
import { apiClient } from './client';
import type {
    LoginRequest,
    LoginResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ApiResponse,
} from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

/** Axios instance for refresh - không dùng Bearer token, gửi refreshToken trong body */
const refreshClient = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
});

export const authApi = {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        // Gửi đúng định dạng { username, password } để BE nhận (tránh thiếu field do undefined)
        const body = {
            username: String(credentials.username ?? '').trim(),
            password: String(credentials.password ?? ''),
        };
        const response = await apiClient.post<ApiResponse<LoginResponse>>(
            '/auth/login',
            body
        );
        return response.data.data;
    },

    forgotPassword: async (body: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
        const response = await apiClient.post<ApiResponse<ForgotPasswordResponse>>(
            '/auth/forgot-password',
            body
        );
        return response.data.data;
    },

    verifyResetCode: async (email: string, code: string): Promise<void> => {
        await apiClient.post('/auth/verify-reset-code', { email, code });
    },

    resetPassword: async (body: ResetPasswordRequest): Promise<void> => {
        await apiClient.post('/auth/reset-password', body);
    },

    /** Gọi refresh token - dùng refreshClient để tránh interceptor thêm Bearer */
    refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
        const response = await refreshClient.post<ApiResponse<LoginResponse>>(
            '/auth/refresh',
            { refreshToken }
        );
        return response.data.data;
    },
};
