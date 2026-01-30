package com.example.smart_garden.repository;

import com.example.smart_garden.entity.FuzzyLogicResult;
import com.example.smart_garden.entity.enums.IrrigationDecision;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FuzzyLogicResultRepository extends JpaRepository<FuzzyLogicResult, Long> {

    /**
     * Tìm tất cả kết quả fuzzy của một device
     */
    List<FuzzyLogicResult> findByDeviceId(Long deviceId);

    /**
     * Tìm kết quả fuzzy với phân trang
     */
    Page<FuzzyLogicResult> findByDeviceIdOrderByTimestampDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm kết quả fuzzy mới nhất của device
     */
    Optional<FuzzyLogicResult> findFirstByDeviceIdOrderByTimestampDesc(Long deviceId);

    /**
     * Tìm kết quả fuzzy theo irrigation decision
     */
    List<FuzzyLogicResult> findByDeviceIdAndIrrigationDecision(Long deviceId, IrrigationDecision decision);

    /**
     * Tìm kết quả fuzzy trong khoảng thời gian
     */
    @Query("SELECT flr FROM FuzzyLogicResult flr WHERE flr.device.id = :deviceId " +
           "AND flr.timestamp BETWEEN :startTime AND :endTime ORDER BY flr.timestamp DESC")
    List<FuzzyLogicResult> findByDeviceIdAndTimestampBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm kết quả fuzzy theo sensor data id
     */
    Optional<FuzzyLogicResult> findBySensorDataId(Long sensorDataId);

    /**
     * Đếm số kết quả fuzzy của device
     */
    long countByDeviceId(Long deviceId);
}
