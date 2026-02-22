package com.example.smart_garden.repository;

import com.example.smart_garden.entity.DeviceWaterBalanceState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeviceWaterBalanceStateRepository extends JpaRepository<DeviceWaterBalanceState, Long> {

    /**
     * Tìm water balance state theo device_id
     */
    Optional<DeviceWaterBalanceState> findByDeviceId(Long deviceId);

    /**
     * Kiểm tra state đã tồn tại cho device
     */
    boolean existsByDeviceId(Long deviceId);
}
