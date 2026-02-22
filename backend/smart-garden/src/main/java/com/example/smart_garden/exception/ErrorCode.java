package com.example.smart_garden.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Enum định nghĩa tất cả các mã lỗi trong hệ thống.
 * Được sử dụng bởi AppException và GlobalExceptionHandler.
 */
@Getter
public enum ErrorCode {

    // ================== SYSTEM ERRORS (1xxx) ==================
    UNCATEGORIZED_EXCEPTION(1000, "Uncategorized error", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_KEY(1001, "Invalid message key", HttpStatus.BAD_REQUEST),
    INTERNAL_ERROR(1002, "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),

    // ================== AUTHENTICATION ERRORS (2xxx) ==================
    UNAUTHENTICATED(2001, "Unauthenticated", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(2002, "You do not have permission", HttpStatus.FORBIDDEN),
    INVALID_TOKEN(2003, "Invalid token", HttpStatus.UNAUTHORIZED),
    TOKEN_EXPIRED(2004, "Token has expired", HttpStatus.UNAUTHORIZED),
    BAD_CREDENTIALS(2005, "Invalid username or password", HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(2005, "Invalid username or password", HttpStatus.UNAUTHORIZED),
    ACCOUNT_DISABLED(2006, "Account is disabled", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED(2007, "Access denied", HttpStatus.FORBIDDEN),
    RESET_TOKEN_INVALID(2008, "Invalid or expired reset link", HttpStatus.BAD_REQUEST),

    // ================== USER ERRORS (3xxx) ==================
    USER_NOT_FOUND(3001, "User not found", HttpStatus.NOT_FOUND),
    USER_EXISTED(3002, "User already exists", HttpStatus.BAD_REQUEST),
    INVALID_PASSWORD(3003, "Invalid password", HttpStatus.BAD_REQUEST),
    USERNAME_INVALID(3004, "Username must be at least 3 characters", HttpStatus.BAD_REQUEST),
    PASSWORD_INVALID(3005, "Password must be at least 8 characters", HttpStatus.BAD_REQUEST),
    EMAIL_INVALID(3006, "Invalid email format", HttpStatus.BAD_REQUEST),

    // ================== DEVICE ERRORS (4xxx) ==================
    DEVICE_NOT_FOUND(4001, "Device not found", HttpStatus.NOT_FOUND),
    DEVICE_EXISTED(4002, "Device already exists", HttpStatus.BAD_REQUEST),
    DEVICE_OFFLINE(4003, "Device is offline", HttpStatus.SERVICE_UNAVAILABLE),
    INVALID_DEVICE_STATUS(4004, "Invalid device status", HttpStatus.BAD_REQUEST),
    GPIO_PIN_CONFLICT(4005, "GPIO pin already in use", HttpStatus.CONFLICT),
    DEVICE_ALREADY_REGISTERED(4006, "Thiết bị đã được tài khoản khác đăng ký", HttpStatus.CONFLICT),
    INVALID_MAC_ADDRESS(4007, "Địa chỉ MAC không hợp lệ", HttpStatus.BAD_REQUEST),

    // ================== MCU/GATEWAY ERRORS (5xxx) ==================
    MCU_NOT_FOUND(5001, "MCU gateway not found", HttpStatus.NOT_FOUND),
    MCU_OFFLINE(5002, "MCU gateway is offline", HttpStatus.SERVICE_UNAVAILABLE),
    MCU_EXISTED(5003, "MCU gateway already exists", HttpStatus.BAD_REQUEST),
    MQTT_CONNECTION_ERROR(5004, "MQTT connection error", HttpStatus.SERVICE_UNAVAILABLE),

    // ================== SCHEDULE ERRORS (6xxx) ==================
    SCHEDULE_NOT_FOUND(6001, "Schedule not found", HttpStatus.NOT_FOUND),
    INVALID_SCHEDULE_TIME(6002, "Invalid schedule time", HttpStatus.BAD_REQUEST),
    SCHEDULE_CONFLICT(6003, "Schedule conflict", HttpStatus.CONFLICT),

    // ================== SENSOR ERRORS (7xxx) ==================
    SENSOR_NOT_FOUND(7001, "Sensor not found", HttpStatus.NOT_FOUND),
    INVALID_SENSOR_DATA(7002, "Invalid sensor data", HttpStatus.BAD_REQUEST),

    // ================== IRRIGATION ERRORS (8xxx) ==================
    ZONE_NOT_FOUND(8001, "Irrigation zone not found", HttpStatus.NOT_FOUND),
    IRRIGATION_CONFIG_NOT_FOUND(8002, "Irrigation config not found", HttpStatus.NOT_FOUND),

    // ================== RBAC ERRORS (10xxx) ==================
    ROLE_NOT_FOUND(10001, "Role not found", HttpStatus.NOT_FOUND),
    ROLE_EXISTED(10002, "Role already exists", HttpStatus.BAD_REQUEST),
    ROLE_IN_USE(10003, "Role is in use and cannot be deleted", HttpStatus.CONFLICT),
    SYSTEM_ROLE_CANNOT_BE_DELETED(10004, "System role cannot be deleted", HttpStatus.FORBIDDEN),
    PERMISSION_NOT_FOUND(10005, "Permission not found", HttpStatus.NOT_FOUND),
    PERMISSION_EXISTED(10006, "Permission already exists", HttpStatus.BAD_REQUEST),
    PERMISSION_IN_USE(10007, "Permission is in use and cannot be deleted", HttpStatus.CONFLICT),

    // ================== AI SERVICE / ML ERRORS (11xxx) ==================
    AI_PREDICTION_FAILED(11001, "AI prediction failed", HttpStatus.INTERNAL_SERVER_ERROR),
    AI_TRAINING_FAILED(11002, "AI training failed", HttpStatus.INTERNAL_SERVER_ERROR),
    AI_SERVICE_UNAVAILABLE(11003, "AI service unavailable", HttpStatus.SERVICE_UNAVAILABLE),
    AI_SERVICE_NOT_ENABLED(11004, "AI service is not enabled for this device", HttpStatus.BAD_REQUEST),
    ML_PREDICTION_NOT_FOUND(11005, "ML prediction not found", HttpStatus.NOT_FOUND),

    // ================== AGRO-PHYSICS ERRORS (12xxx) ==================
    CROP_NOT_FOUND(12001, "Crop not found in library", HttpStatus.NOT_FOUND),
    SOIL_NOT_FOUND(12002, "Soil type not found in library", HttpStatus.NOT_FOUND),
    CROP_SEASON_NOT_FOUND(12003, "Crop season not found", HttpStatus.NOT_FOUND),
    NO_ACTIVE_SEASON(12004, "No active crop season for this device", HttpStatus.NOT_FOUND),
    WATER_BALANCE_NOT_FOUND(12005, "Water balance record not found", HttpStatus.NOT_FOUND),
    ET0_CALCULATION_FAILED(12006, "ET0 calculation failed due to insufficient weather data",
            HttpStatus.INTERNAL_SERVER_ERROR),

    // ================== VALIDATION ERRORS (9xxx) ==================
    INVALID_REQUEST(9001, "Invalid request", HttpStatus.BAD_REQUEST),
    VALIDATION_ERROR(9002, "Validation error", HttpStatus.BAD_REQUEST),
    RESOURCE_NOT_FOUND(9003, "Resource not found", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(9004, "Method not allowed", HttpStatus.METHOD_NOT_ALLOWED),
    MISSING_REQUIRED_FIELD(9005, "Missing required field", HttpStatus.BAD_REQUEST);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }
}
