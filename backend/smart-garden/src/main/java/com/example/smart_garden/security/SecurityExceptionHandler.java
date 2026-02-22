package com.example.smart_garden.security;

import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Xử lý exception liên quan security, trả về ApiResponse thống nhất với
 * ErrorCode.
 * Order(-1) để ưu tiên handler security trước GlobalExceptionHandler.
 */
@RestControllerAdvice
@Order(-1)
public class SecurityExceptionHandler {

        private static final Logger log = LoggerFactory.getLogger(SecurityExceptionHandler.class);

        @ExceptionHandler(BadCredentialsException.class)
        public ResponseEntity<ApiResponse<Void>> handleBadCredentials(
                        BadCredentialsException ex,
                        HttpServletRequest request) {
                ErrorCode errorCode = ErrorCode.BAD_CREDENTIALS;
                log.debug("Bad credentials: {} - {}", request.getRequestURI(), ex.getMessage());
                return ResponseEntity
                                .status(errorCode.getHttpStatus())
                                .body(ApiResponse.fail(errorCode.getCode(), errorCode.getMessage()));
        }

        @ExceptionHandler(DisabledException.class)
        public ResponseEntity<ApiResponse<Void>> handleDisabled(
                        DisabledException ex,
                        HttpServletRequest request) {
                ErrorCode errorCode = ErrorCode.ACCOUNT_DISABLED;
                log.debug("Disabled user: {} - {}", request.getRequestURI(), ex.getMessage());
                return ResponseEntity
                                .status(errorCode.getHttpStatus())
                                .body(ApiResponse.fail(errorCode.getCode(), errorCode.getMessage()));
        }

        @ExceptionHandler(AuthenticationException.class)
        public ResponseEntity<ApiResponse<Void>> handleAuthentication(
                        AuthenticationException ex,
                        HttpServletRequest request) {
                ErrorCode errorCode = ErrorCode.UNAUTHENTICATED;
                log.debug("Authentication failed: {} - {}", request.getRequestURI(), ex.getMessage());
                return ResponseEntity
                                .status(errorCode.getHttpStatus())
                                .body(ApiResponse.fail(errorCode.getCode(),
                                                ex.getMessage() != null ? ex.getMessage() : errorCode.getMessage()));
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<ApiResponse<Void>> handleAccessDenied(
                        AccessDeniedException ex,
                        HttpServletRequest request) {
                ErrorCode errorCode = ErrorCode.ACCESS_DENIED;
                log.debug("Access denied: {} - {}", request.getRequestURI(), ex.getMessage());
                return ResponseEntity
                                .status(errorCode.getHttpStatus())
                                .body(ApiResponse.fail(errorCode.getCode(), errorCode.getMessage()));
        }
}
