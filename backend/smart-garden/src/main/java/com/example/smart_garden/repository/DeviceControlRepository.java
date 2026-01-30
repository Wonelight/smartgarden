package com.example.smart_garden.repository;

import com.example.smart_garden.entity.DeviceControl;
import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlInitiatedBy;
import com.example.smart_garden.entity.enums.ControlStatus;
import com.example.smart_garden.entity.enums.ControlType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DeviceControlRepository extends JpaRepository<DeviceControl, Long> {

    /**
     * Tìm tất cả lệnh điều khiển của một device
     */
    List<DeviceControl> findByDeviceId(Long deviceId);

    /**
     * Tìm lệnh điều khiển với phân trang
     */
    Page<DeviceControl> findByDeviceIdOrderByCreatedAtDesc(Long deviceId, Pageable pageable);

    /**
     * Tìm lệnh điều khiển theo status
     */
    List<DeviceControl> findByDeviceIdAndStatus(Long deviceId, ControlStatus status);

    /**
     * Tìm lệnh điều khiển đang pending
     */
    List<DeviceControl> findByDeviceIdAndStatus(Long deviceId, ControlStatus status);

    /**
     * Tìm lệnh điều khiển theo type và action
     */
    List<DeviceControl> findByDeviceIdAndControlTypeAndAction(
            Long deviceId, 
            ControlType controlType, 
            ControlAction action
    );

    /**
     * Tìm lệnh điều khiển theo người khởi tạo
     */
    List<DeviceControl> findByDeviceIdAndInitiatedBy(Long deviceId, ControlInitiatedBy initiatedBy);

    /**
     * Tìm lệnh điều khiển của user
     */
    List<DeviceControl> findByUserId(Long userId);

    /**
     * Tìm lệnh điều khiển trong khoảng thời gian
     */
    @Query("SELECT dc FROM DeviceControl dc WHERE dc.device.id = :deviceId " +
           "AND dc.createdAt BETWEEN :startTime AND :endTime ORDER BY dc.createdAt DESC")
    List<DeviceControl> findByDeviceIdAndCreatedAtBetween(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    /**
     * Tìm lệnh điều khiển chưa được thực thi
     */
    @Query("SELECT dc FROM DeviceControl dc WHERE dc.device.id = :deviceId " +
           "AND dc.status = 'PENDING' ORDER BY dc.createdAt ASC")
    List<DeviceControl> findPendingByDeviceId(@Param("deviceId") Long deviceId);

    /**
     * Đếm số lệnh điều khiển của device
     */
    long countByDeviceId(Long deviceId);
}
