package com.example.smart_garden.repository;

import com.example.smart_garden.entity.CropSeason;
import com.example.smart_garden.entity.enums.CropSeasonStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CropSeasonRepository extends JpaRepository<CropSeason, Long> {

    /**
     * Find all seasons by status (used by BatchJobService to iterate ACTIVE
     * seasons).
     */
    List<CropSeason> findByStatus(CropSeasonStatus status);

    /**
     * Find active season for a specific device.
     */
    Optional<CropSeason> findByDeviceIdAndStatus(Long deviceId, CropSeasonStatus status);

    /**
     * Find all seasons for a device.
     */
    List<CropSeason> findByDeviceId(Long deviceId);

    /**
     * Check if any crop season uses this soil (for delete guard).
     */
    boolean existsBySoil_Id(Long soilId);
}
