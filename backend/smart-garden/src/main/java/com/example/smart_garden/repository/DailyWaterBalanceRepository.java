package com.example.smart_garden.repository;

import com.example.smart_garden.entity.DailyWaterBalance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface DailyWaterBalanceRepository extends JpaRepository<DailyWaterBalance, Long> {

    /**
     * Get the latest water balance entry for a season (used to find previous DC
     * value).
     */
    Optional<DailyWaterBalance> findTopByCropSeasonIdOrderByDateDesc(Long seasonId);

    /**
     * Find water balance for a specific season and date.
     */
    Optional<DailyWaterBalance> findByCropSeasonIdAndDate(Long seasonId, LocalDate date);

    /**
     * Paginated history for a season, ordered by date descending.
     */
    Page<DailyWaterBalance> findByCropSeasonIdOrderByDateDesc(Long seasonId, Pageable pageable);
}
