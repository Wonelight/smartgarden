import type { AxiosError } from 'axios';
import type { ApiErrorBody, ValidationErrors } from '../types/api';

/**
 * Kiểm tra data có phải error body từ BE (ApiResponse fail).
 */
function isApiErrorBody(data: unknown): data is ApiErrorBody {
    if (!data || typeof data !== 'object') return false;
    const o = data as Record<string, unknown>;
    return o.success === false && (typeof o.message === 'string' || o.message === null);
}

/**
 * Lấy thông báo lỗi hiển thị cho user từ AxiosError.
 * Ưu tiên message từ BE, fallback cho lỗi mạng / timeout / không xác định.
 */
export function getApiErrorMessage(error: unknown): string {
    if (!error) return 'Đã xảy ra lỗi. Vui lòng thử lại.';

    const axiosError = error as AxiosError<ApiErrorBody>;
    const data = axiosError.response?.data;

    if (isApiErrorBody(data) && data.message) {
        return data.message;
    }

    if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 401) return 'Phiên đăng nhập hết hạn hoặc không hợp lệ.';
        if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
        if (status === 404) return 'Không tìm thấy tài nguyên.';
        if (status >= 500) return 'Lỗi hệ thống. Vui lòng thử lại sau.';
    }

    if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        return 'Kết nối quá thời gian. Vui lòng kiểm tra mạng và thử lại.';
    }

    if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
        return 'Không thể kết nối đến máy chủ. Kiểm tra mạng hoặc thử lại sau.';
    }

    return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/**
 * Lấy mã lỗi từ BE (ErrorCode) nếu có.
 */
export function getApiErrorCode(error: unknown): number | null {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const data = axiosError.response?.data;
    if (isApiErrorBody(data) && typeof data.code === 'number') {
        return data.code;
    }
    return null;
}

/**
 * Lấy chi tiết lỗi validation (field -> message) từ BE.
 * Dùng khi code = 9002 (VALIDATION_ERROR) và data là object.
 */
export function getValidationErrors(error: unknown): ValidationErrors | null {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const data = axiosError.response?.data;
    if (!data?.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
        return null;
    }
    const entries = Object.entries(data.data).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
    );
    return entries.length ? Object.fromEntries(entries) : null;
}
