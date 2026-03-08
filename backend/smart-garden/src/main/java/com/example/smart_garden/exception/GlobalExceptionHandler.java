package com.example.smart_garden.exception;

import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.entity.enums.LogSource;
import com.example.smart_garden.event.SystemLogPublisher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler - Xử lý tập trung tất cả exceptions trong hệ thống.
 * Trả về ApiResponse thống nhất với error code.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Autowired
    private SystemLogPublisher sysLog;

    /**
     * Xử lý AppException - Business logic errors.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(
            AppException ex,
            HttpServletRequest request) {
        ErrorCode errorCode = ex.getErrorCode();
        log.warn("AppException: {} - {} - Code: {}",
                request.getRequestURI(), ex.getMessage(), errorCode.getCode());

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(), ex.getMessage()));
    }

    /**
     * Xử lý validation errors từ @Valid annotation.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        Map<String, String> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> error.getDefaultMessage() != null ? error.getDefaultMessage() : "Invalid value",
                        (existing, replacement) -> existing));

        log.warn("Validation error: {} - {}", request.getRequestURI(), errors);

        ErrorCode errorCode = ErrorCode.VALIDATION_ERROR;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(), "Validation failed", errors));
    }

    /**
     * Xử lý ConstraintViolationException từ @Validated.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleConstraintViolation(
            ConstraintViolationException ex,
            HttpServletRequest request) {
        Map<String, String> errors = ex.getConstraintViolations()
                .stream()
                .collect(Collectors.toMap(
                        violation -> violation.getPropertyPath().toString(),
                        ConstraintViolation::getMessage,
                        (existing, replacement) -> existing));

        log.warn("Constraint violation: {} - {}", request.getRequestURI(), errors);

        ErrorCode errorCode = ErrorCode.VALIDATION_ERROR;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(), "Constraint violation", errors));
    }

    /**
     * Xử lý missing request parameter.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request) {
        log.warn("Missing parameter: {} - {}", request.getRequestURI(), ex.getParameterName());

        ErrorCode errorCode = ErrorCode.MISSING_REQUIRED_FIELD;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(),
                        "Missing required parameter: " + ex.getParameterName()));
    }

    /**
     * Xử lý type mismatch (e.g., String thay vì Long).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {
        log.warn("Type mismatch: {} - {} expected {}",
                request.getRequestURI(), ex.getName(), ex.getRequiredType());

        ErrorCode errorCode = ErrorCode.INVALID_REQUEST;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(),
                        "Invalid parameter type for: " + ex.getName()));
    }

    /**
     * Xử lý HTTP method not supported.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request) {
        log.warn("Method not supported: {} - {}", request.getRequestURI(), ex.getMethod());

        ErrorCode errorCode = ErrorCode.METHOD_NOT_ALLOWED;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(),
                        "Method " + ex.getMethod() + " not supported"));
    }

    /**
     * Xử lý resource not found (404).
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(
            NoResourceFoundException ex,
            HttpServletRequest request) {
        log.debug("Resource not found: {}", request.getRequestURI());

        ErrorCode errorCode = ErrorCode.RESOURCE_NOT_FOUND;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(), "Resource not found"));
    }

    /**
     * Fallback handler cho tất cả uncategorized exceptions.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUncaughtException(
            Exception ex,
            HttpServletRequest request) {
        log.error("Uncaught exception: {} - {}", request.getRequestURI(), ex.getMessage(), ex);

        StringWriter sw = new StringWriter();
        ex.printStackTrace(new PrintWriter(sw));
        String stackTrace = sw.toString();
        if (stackTrace.length() > 4000) stackTrace = stackTrace.substring(0, 4000) + "...";
        sysLog.error(LogSource.BACKEND, null,
                "Uncaught exception at " + request.getRequestURI() + ": " + ex.getMessage(),
                stackTrace);

        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.fail(errorCode.getCode(), "An unexpected error occurred"));
    }
}
