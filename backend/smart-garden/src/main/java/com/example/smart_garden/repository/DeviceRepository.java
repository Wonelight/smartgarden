package com.example.smart_garden.repository;

import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.enums.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {

    /**
     * Tìm device theo device code (MAC address)
     */
    Optional<Device> findByDeviceCode(String deviceCode);

    /**
     * Kiểm tra device code đã tồn tại chưa
     */
    boolean existsByDeviceCode(String deviceCode);

    /**
     * Tìm tất cả device của một user
     */
    List<Device> findByUserId(Long userId);

    /**
     * Tìm device theo status
     */
    List<Device> findByStatus(DeviceStatus status);

    /**
     * Tìm device của user theo status
     */
    List<Device> findByUserIdAndStatus(Long userId, DeviceStatus status);

    /**
     * Tìm device offline quá lâu (trước thời điểm chỉ định)
     */
    @Query("SELECT d FROM Device d WHERE d.status = :status AND d.lastOnline < :beforeTime")
    List<Device> findOfflineDevicesBefore(@Param("status") DeviceStatus status, @Param("beforeTime") LocalDateTime beforeTime);

    /**
     * Đếm số device của user
     */
    long countByUserId(Long userId);

    /**
     * Đếm số device theo status
     */
    long countByStatus(DeviceStatus status);
}
