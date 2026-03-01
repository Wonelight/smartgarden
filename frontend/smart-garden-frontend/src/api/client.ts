import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { storage } from '../utils/storage';
import { getApiErrorMessage, getApiErrorCode } from '../utils/apiError';
import { authApi } from './auth';

// Create axios instance with base configuration
export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Flag và queue cho refresh token - tránh gọi refresh nhiều lần đồng thời
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
}> = [];

/** Tránh toast trùng khi nhiều request cùng lúc 401/403 → redirect login */
let isRedirectingToLogin = false;

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

const processQueue = (newToken: string | null, err: unknown = null) => {
    failedQueue.forEach((promise) => {
        if (newToken) {
            promise.resolve(newToken);
        } else {
            promise.reject(err);
        }
    });
    failedQueue = [];
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = storage.getToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response interceptor: 401 -> thử refresh token, thất bại mới redirect login
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;

        // Không xử lý refresh nếu đây là request refresh hoặc đã retry
        const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');

        if (status === 401 && !isRefreshRequest && !originalRequest?._retry) {
            const refreshToken = storage.getRefreshToken();

            if (!refreshToken) {
                if (isRedirectingToLogin) {
                    return Promise.reject(error);
                }
                isRedirectingToLogin = true;
                storage.clear();
                try {
                    (await import('../store/authStore')).useAuthStore.getState().logout();
                } catch {
                    // ignore circular/init
                }
                toast.error(SESSION_EXPIRED_MESSAGE);
                window.location.href = '/login';
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Đang refresh, chờ token mới rồi retry
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            if (originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                            }
                            originalRequest._retry = true;
                            resolve(apiClient(originalRequest));
                        },
                        reject,
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await authApi.refreshToken(refreshToken);
                const persistent = storage.isPersistent();
                storage.setToken(response.accessToken, persistent);
                storage.setRefreshToken(response.refreshToken, persistent);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;
                }
                processQueue(response.accessToken);
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(null, refreshError);
                isRedirectingToLogin = true;
                storage.clear();
                try {
                    (await import('../store/authStore')).useAuthStore.getState().logout();
                } catch {
                    // ignore
                }
                toast.error(SESSION_EXPIRED_MESSAGE);
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // 403 (Forbidden): thường do token hết hạn hoặc không hợp lệ — logout và chuyển về login, chỉ 1 toast
        if (status === 403) {
            if (isRedirectingToLogin) {
                return Promise.reject(error);
            }
            isRedirectingToLogin = true;
            storage.clear();
            try {
                (await import('../store/authStore')).useAuthStore.getState().logout();
            } catch {
                // ignore
            }
            toast.error(SESSION_EXPIRED_MESSAGE);
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // Đang chuyển về login (401/403 đã xử lý) — không toast thêm để tránh trùng
        if (isRedirectingToLogin) {
            return Promise.reject(error);
        }

        // Lỗi validation (9002): không toast ở đây để trang có thể hiển thị lỗi theo từng trường
        if (getApiErrorCode(error) === 9002) {
            return Promise.reject(error);
        }

        // Hiển thị thông báo lỗi từ BE cho mọi lỗi còn lại (4xx, 5xx, network)
        toast.error(getApiErrorMessage(error));
        return Promise.reject(error);
    }
);
