package com.example.smart_garden.repository;

import com.example.smart_garden.entity.Schedule;
import com.example.smart_garden.entity.enums.ScheduleType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    /**
     * Tìm tất cả lịch tưới của một device
     */
    List<Schedule> findByDeviceId(Long deviceId);

    /**
     * Tìm lịch tưới đang active
     */
    List<Schedule> findByDeviceIdAndIsActiveTrue(Long deviceId);

    /**
     * Tìm lịch tưới theo type
     */
    List<Schedule> findByDeviceIdAndScheduleType(Long deviceId, ScheduleType scheduleType);

    /**
     * Tìm lịch tưới active theo type
     */
    List<Schedule> findByDeviceIdAndScheduleTypeAndIsActiveTrue(
            Long deviceId, 
            ScheduleType scheduleType
    );

    /**
     * Tìm lịch tưới theo thời gian trong ngày
     */
    List<Schedule> findByDeviceIdAndTimeOfDayAndIsActiveTrue(
            Long deviceId, 
            LocalTime timeOfDay
    );

    /**
     * Tìm lịch tưới daily active
     */
    @Query("SELECT s FROM Schedule s WHERE s.device.id = :deviceId " +
           "AND s.scheduleType = 'DAILY' AND s.isActive = true")
    List<Schedule> findActiveDailySchedules(@Param("deviceId") Long deviceId);

    /**
     * Tìm lịch tưới weekly active cho một ngày trong tuần
     */
    @Query("SELECT s FROM Schedule s WHERE s.device.id = :deviceId " +
           "AND s.scheduleType = 'WEEKLY' AND s.isActive = true " +
           "AND (s.daysOfWeek LIKE CONCAT('%', :dayOfWeek, '%'))")
    List<Schedule> findActiveWeeklySchedulesByDay(
            @Param("deviceId") Long deviceId,
            @Param("dayOfWeek") String dayOfWeek
    );

    /**
     * Đếm số lịch tưới của device
     */
    long countByDeviceId(Long deviceId);

    /**
     * Đếm số lịch tưới active của device
     */
    long countByDeviceIdAndIsActiveTrue(Long deviceId);
}
