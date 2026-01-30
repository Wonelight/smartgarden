package com.example.smart_garden.repository;

import com.example.smart_garden.entity.IrrigationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IrrigationConfigRepository extends JpaRepository<IrrigationConfig, Long> {

    /**
     * Tìm config theo device id (1:1 relationship)
     */
    Optional<IrrigationConfig> findByDeviceId(Long deviceId);

    /**
     * Kiểm tra device đã có config chưa
     */
    boolean existsByDeviceId(Long deviceId);

    /**
     * Xóa config theo device id
     */
    void deleteByDeviceId(Long deviceId);
}
