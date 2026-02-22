package com.example.smart_garden.exception;

import lombok.Getter;

/**
 * Custom exception cho business logic errors.
 * Sử dụng ErrorCode enum để định nghĩa loại lỗi.
 */
@Getter
public class AppException extends RuntimeException {

    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /**
     * Constructor với custom message, override message mặc định từ ErrorCode.
     *
     * @param errorCode     mã lỗi
     * @param customMessage message tùy chỉnh
     */
    public AppException(ErrorCode errorCode, String customMessage) {
        super(customMessage);
        this.errorCode = errorCode;
    }

    /**
     * Constructor với cause exception.
     *
     * @param errorCode mã lỗi
     * @param cause     exception gốc
     */
    public AppException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}
