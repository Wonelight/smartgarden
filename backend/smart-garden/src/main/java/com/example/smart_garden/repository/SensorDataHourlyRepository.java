package com.example.smart_garden.repository;

import com.example.smart_garden.entity.SensorDataHourly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SensorDataHourlyRepository extends JpaRepository<SensorDataHourly, Long> {

    /**
     * Lấy dữ liệu hourly trong khoảng thời gian cho device.
     */
    List<SensorDataHourly> findByDeviceIdAndHourStartBetweenOrderByHourStartDesc(
            Long deviceId, LocalDateTime start, LocalDateTime end);

    /**
     * Kiểm tra đã có aggregation cho device + hour chưa.
     */
    Optional<SensorDataHourly> findByDeviceIdAndHourStart(Long deviceId, LocalDateTime hourStart);

    /**
     * Xóa dữ liệu hourly cũ hơn cutoff.
     */
    void deleteByHourStartBefore(LocalDateTime cutoff);

    /**
     * Lấy tối đa 1000 record cũ nhất trước cutoff — dùng cho batch delete.
     */
    List<SensorDataHourly> findTop1000ByHourStartBeforeOrderByHourStartAsc(LocalDateTime cutoff);
}
