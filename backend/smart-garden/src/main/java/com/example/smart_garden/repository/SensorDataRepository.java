package com.example.smart_garden.repository;

import com.example.smart_garden.entity.SensorData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
                     @Param("endTime") LocalDateTime endTime);

       /**
        * Tìm tất cả sensor data trong khoảng thời gian (dùng cho aggregation job).
        */
       @Query("SELECT sd FROM SensorData sd WHERE sd.timestamp BETWEEN :startTime AND :endTime ORDER BY sd.device.id")
       List<SensorData> findAllByTimestampBetween(
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

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
        * Batch delete raw sensor data cũ hơn cutoff.
        * Sử dụng LIMIT để tránh lock table quá lâu.
        * Trả về số bản ghi đã xóa.
        */
       @Modifying
       @Query(value = "DELETE FROM sensor_data WHERE timestamp < :cutoff LIMIT :batchSize", nativeQuery = true)
       int deleteOldDataInBatch(@Param("cutoff") LocalDateTime cutoff, @Param("batchSize") int batchSize);

       /**
        * Tính giá trị tổng hợp (AVG/MIN/MAX) các chỉ số sensor từ JSON payload
        * trong khoảng thời gian [startTime, endTime] cho 1 device.
        *
        * Kết quả trả về 1 hàng chứa các cột:
        * sample_count, avg_temp, avg_humidity, avg_soil1, avg_soil2,
        * avg_light, rain_detected_count, min_temp, max_temp,
        * min_humidity, max_humidity, min_soil1, max_soil1
        *
        * Sử dụng MySQL JSON_EXTRACT để đọc giá trị từ cột JSON payload.
        */
       @Query(value = """
                     SELECT
                         COUNT(*)                                                         AS sample_count,
                         AVG(JSON_EXTRACT(payload, '$.temperature'))                      AS avg_temp,
                         AVG(JSON_EXTRACT(payload, '$.humidity'))                          AS avg_humidity,
                         AVG(JSON_EXTRACT(payload, '$.soilMoisture'))                      AS avg_soil1,
                         AVG(JSON_EXTRACT(payload, '$.soilMoisture2'))                     AS avg_soil2,
                         AVG(JSON_EXTRACT(payload, '$.lightIntensity'))                    AS avg_light,
                         SUM(CASE WHEN JSON_EXTRACT(payload, '$.rainDetected') = true
                                       OR JSON_EXTRACT(payload, '$.rainDetected') = 1
                                  THEN 1 ELSE 0 END)                                      AS rain_detected_count,
                         MIN(JSON_EXTRACT(payload, '$.temperature'))                      AS min_temp,
                         MAX(JSON_EXTRACT(payload, '$.temperature'))                      AS max_temp,
                         MIN(JSON_EXTRACT(payload, '$.humidity'))                          AS min_humidity,
                         MAX(JSON_EXTRACT(payload, '$.humidity'))                          AS max_humidity,
                         MIN(JSON_EXTRACT(payload, '$.soilMoisture'))                      AS min_soil1,
                         MAX(JSON_EXTRACT(payload, '$.soilMoisture'))                      AS max_soil1
                     FROM sensor_data
                     WHERE device_id = :deviceId
                       AND timestamp BETWEEN :startTime AND :endTime
                       AND deleted_at IS NULL
                     """, nativeQuery = true)
       List<Object[]> findAggregatedSensorByDeviceIdAndTimeRange(
                     @Param("deviceId") Long deviceId,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

       /**
        * Đếm số bản ghi của device
        */
       long countByDeviceId(Long deviceId);
}
