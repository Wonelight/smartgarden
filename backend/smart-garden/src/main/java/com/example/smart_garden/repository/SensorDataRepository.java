package com.example.smart_garden.repository;

import com.example.smart_garden.entity.SensorData;
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
public interface SensorDataRepository extends JpaRepository<SensorData, Long> {

    /**
     * Tìm tất cả sensor data của một device
     */
    List<SensorData> findByDeviceId(Long deviceId);

    /**
     * Tìm sensor data của device với phân trang
     */
    Page<SensorData> findByDeviceIdOrderByTimestampDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm sensor data mới nhất của device
     */
    Optional<SensorData> findFirstByDeviceIdOrderByTimestampDesc(Long deviceId);

    /**
     * Tìm sensor data trong khoảng thời gian
     */
    @Query("SELECT sd FROM SensorData sd WHERE sd.device.id = :deviceId " +
           "AND sd.timestamp BETWEEN :startTime AND :endTime ORDER BY sd.timestamp DESC")
    List<SensorData> findByDeviceIdAndTimestampBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm sensor data mới nhất của nhiều device
     */
    @Query("SELECT sd FROM SensorData sd WHERE sd.device.id IN :deviceIds " +
           "AND sd.timestamp = (SELECT MAX(sd2.timestamp) FROM SensorData sd2 WHERE sd2.device.id = sd.device.id)")
    List<SensorData> findLatestByDeviceIds(@Param("deviceIds") List<Long> deviceIds);

    /**
     * Xóa sensor data cũ hơn một thời điểm
     */
    void deleteByDeviceIdAndTimestampBefore(Long deviceId, LocalDateTime beforeTime);

    /**
     * Đếm số bản ghi của device
     */
    long countByDeviceId(Long deviceId);
}
