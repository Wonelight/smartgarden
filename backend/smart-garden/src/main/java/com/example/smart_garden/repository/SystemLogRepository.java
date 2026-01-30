package com.example.smart_garden.repository;

import com.example.smart_garden.entity.SystemLog;
import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    /**
     * Tìm tất cả log của một device
     */
    List<SystemLog> findByDeviceId(Long deviceId);

    /**
     * Tìm log với phân trang
     */
    Page<SystemLog> findByDeviceIdOrderByCreatedAtDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm log theo level
     */
    List<SystemLog> findByLogLevel(LogLevel logLevel);

    /**
     * Tìm log theo source
     */
    List<SystemLog> findByLogSource(LogSource logSource);

    /**
     * Tìm log theo device và level
     */
    List<SystemLog> findByDeviceIdAndLogLevel(Long deviceId, LogLevel logLevel);

    /**
     * Tìm log theo device và source
     */
    List<SystemLog> findByDeviceIdAndLogSource(Long deviceId, LogSource logSource);

    /**
     * Tìm log trong khoảng thời gian
     */
    @Query("SELECT sl FROM SystemLog sl WHERE sl.device.id = :deviceId " +
           "AND sl.createdAt BETWEEN :startTime AND :endTime ORDER BY sl.createdAt DESC")
    List<SystemLog> findByDeviceIdAndCreatedAtBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm log theo level và source
     */
    @Query("SELECT sl FROM SystemLog sl WHERE sl.logLevel = :logLevel " +
           "AND sl.logSource = :logSource AND sl.createdAt BETWEEN :startTime AND :endTime " +
           "ORDER BY sl.createdAt DESC")
    List<SystemLog> findByLogLevelAndLogSourceAndCreatedAtBetween(
            @Param("logLevel") LogLevel logLevel,
            @Param("logSource") LogSource logSource,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm log lỗi (ERROR, CRITICAL)
     */
    @Query("SELECT sl FROM SystemLog sl WHERE sl.logLevel IN ('ERROR', 'CRITICAL') " +
           "AND sl.createdAt >= :since ORDER BY sl.createdAt DESC")
    List<SystemLog> findErrorLogsSince(@Param("since") LocalDateTime since);

    /**
     * Xóa log cũ hơn một thời điểm
     */
    void deleteByCreatedAtBefore(LocalDateTime beforeTime);

    /**
     * Đếm số log của device
     */
    long countByDeviceId(Long deviceId);
}
