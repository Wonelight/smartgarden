package com.example.smart_garden.dto.common;

/**
 * Wrapper chuẩn cho mọi response.
 *
 * @param <T> kiểu dữ liệu payload
 */
public record ApiResponse<T>(
        boolean success,
        Integer code,
        String message,
        T data) {

    // ================== SUCCESS METHODS ==================

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, null, null, data);
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, null, message, data);
    }

    // ================== FAILURE METHODS ==================

    /**
     * Tạo response thất bại với message (không có error code).
     */
    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, null, message, null);
    }

    /**
     * Tạo response thất bại với error code và message.
     */
    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }

    /**
     * Tạo response thất bại với error code, message và data (e.g., validation
     * errors).
     */
    public static <T> ApiResponse<T> fail(int code, String message, T data) {
        return new ApiResponse<>(false, code, message, data);
    }
}
