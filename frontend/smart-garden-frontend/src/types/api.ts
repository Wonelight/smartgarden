/**
 * Cấu trúc response từ backend (ApiResponse.java).
 * Dùng chung cho success và error.
 */
export interface ApiResponseBody<T = unknown> {
    success: boolean;
    code: number | null;
    message: string | null;
    data: T | null;
}

/**
 * Payload lỗi validation từ BE (Map<String, String>).
 * Key = tên field, value = thông báo lỗi.
 */
export type ValidationErrors = Record<string, string>;

/**
 * Error response từ BE khi success = false.
 * data có thể là ValidationErrors khi code = 9002 (VALIDATION_ERROR).
 */
export type ApiErrorBody = ApiResponseBody<ValidationErrors>;
