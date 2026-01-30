package com.example.smart_garden.repository;

import com.example.smart_garden.entity.IrrigationHistory;
import com.example.smart_garden.entity.enums.IrrigationHistoryStatus;
import com.example.smart_garden.entity.enums.IrrigationMode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IrrigationHistoryRepository extends JpaRepository<IrrigationHistory, Long> {

    /**
     * Tìm tất cả lịch sử tưới của một device
     */
    List<IrrigationHistory> findByDeviceId(Long deviceId);

    /**
     * Tìm lịch sử tưới với phân trang
     */
    Page<IrrigationHistory> findByDeviceIdOrderByStartTimeDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm lịch sử tưới theo mode
     */
    List<IrrigationHistory> findByDeviceIdAndIrrigationMode(Long deviceId, IrrigationMode mode);

    /**
     * Tìm lịch sử tưới theo status
     */
    List<IrrigationHistory> findByDeviceIdAndStatus(Long deviceId, IrrigationHistoryStatus status);

    /**
     * Tìm lịch sử tưới trong khoảng thời gian
     */
    @Query("SELECT ih FROM IrrigationHistory ih WHERE ih.device.id = :deviceId " +
           "AND ih.startTime BETWEEN :startTime AND :endTime ORDER BY ih.startTime DESC")
    List<IrrigationHistory> findByDeviceIdAndStartTimeBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm lịch sử tưới theo fuzzy result id
     */
    List<IrrigationHistory> findByFuzzyResultId(Long fuzzyResultId);

    /**
     * Tìm lịch sử tưới theo ML prediction id
     */
    List<IrrigationHistory> findByMlPredictionId(Long mlPredictionId);

    /**
     * Tính tổng thời gian tưới của device trong khoảng thời gian
     */
    @Query("SELECT SUM(ih.duration) FROM IrrigationHistory ih " +
           "WHERE ih.device.id = :deviceId AND ih.startTime BETWEEN :startTime AND :endTime")
    Long sumDurationByDeviceIdAndStartTimeBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Đếm số lần tưới của device
     */
    long countByDeviceId(Long deviceId);
}
