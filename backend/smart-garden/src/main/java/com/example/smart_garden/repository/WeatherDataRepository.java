package com.example.smart_garden.repository;

import com.example.smart_garden.entity.WeatherData;
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
public interface WeatherDataRepository extends JpaRepository<WeatherData, Long> {

    /**
     * Tìm dữ liệu thời tiết theo location
     */
    List<WeatherData> findByLocation(String location);

    /**
     * Tìm dữ liệu thời tiết với phân trang
     */
    Page<WeatherData> findByLocationOrderByForecastTimeDesc(String location, Pageable pageable);

    /**
     * Tìm dữ liệu thời tiết mới nhất của location
     */
    Optional<WeatherData> findFirstByLocationOrderByForecastTimeDesc(String location);

    /**
     * Tìm dữ liệu thời tiết trong khoảng thời gian
     */
    @Query("SELECT wd FROM WeatherData wd WHERE wd.location = :location " +
           "AND wd.forecastTime BETWEEN :startTime AND :endTime ORDER BY wd.forecastTime DESC")
    List<WeatherData> findByLocationAndForecastTimeBetween(
            @Param("location") String location,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm dữ liệu thời tiết tại một thời điểm cụ thể
     */
    @Query("SELECT wd FROM WeatherData wd WHERE wd.location = :location " +
           "AND wd.forecastTime <= :forecastTime ORDER BY wd.forecastTime DESC")
    List<WeatherData> findLatestByLocationAndForecastTime(
            @Param("location") String location,
            @Param("forecastTime") LocalDateTime forecastTime
    );

    /**
     * Xóa dữ liệu thời tiết cũ hơn một thời điểm
     */
    void deleteByCreatedAtBefore(LocalDateTime beforeTime);

    /**
     * Đếm số bản ghi theo location
     */
    long countByLocation(String location);
}
