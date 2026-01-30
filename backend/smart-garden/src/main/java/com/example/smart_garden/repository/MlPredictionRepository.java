package com.example.smart_garden.repository;

import com.example.smart_garden.entity.MlPrediction;
import com.example.smart_garden.entity.enums.PredictionType;
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
public interface MlPredictionRepository extends JpaRepository<MlPrediction, Long> {

    /**
     * Tìm tất cả dự báo ML của một device
     */
    List<MlPrediction> findByDeviceId(Long deviceId);

    /**
     * Tìm dự báo ML với phân trang
     */
    Page<MlPrediction> findByDeviceIdOrderByCreatedAtDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm dự báo ML mới nhất của device
     */
    Optional<MlPrediction> findFirstByDeviceIdOrderByCreatedAtDesc(Long deviceId);

    /**
     * Tìm dự báo ML theo loại
     */
    List<MlPrediction> findByDeviceIdAndPredictionType(Long deviceId, PredictionType predictionType);

    /**
     * Tìm dự báo ML mới nhất theo loại
     */
    Optional<MlPrediction> findFirstByDeviceIdAndPredictionTypeOrderByCreatedAtDesc(
            Long deviceId, 
            PredictionType predictionType
    );

    /**
     * Tìm dự báo ML trong khoảng thời gian
     */
    @Query("SELECT mlp FROM MlPrediction mlp WHERE mlp.device.id = :deviceId " +
           "AND mlp.createdAt BETWEEN :startTime AND :endTime ORDER BY mlp.createdAt DESC")
    List<MlPrediction> findByDeviceIdAndCreatedAtBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Đếm số dự báo ML của device
     */
    long countByDeviceId(Long deviceId);
}
