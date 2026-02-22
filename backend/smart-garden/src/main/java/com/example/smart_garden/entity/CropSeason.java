package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.CropSeasonStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "crop_season", indexes = {
        @Index(name = "idx_crop_season_device_status", columnList = "device_id, status")
})
@Where(clause = "deleted_at IS NULL")
public class CropSeason extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crop_id", nullable = false)
    private CropLibrary crop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "soil_id", nullable = false)
    private SoilLibrary soil;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "initial_root_depth", nullable = false)
    private Float initialRootDepth;

    /**
     * Override tỷ lệ thẩm thấu cho season này (0-1).
     * Null = dùng SoilLibrary.infiltration_shallow_ratio.
     * Cho phép tùy chỉnh theo cặp (cây trồng + loại đất).
     * Ví dụ: Cây rễ nông trên đất cát có thể override từ 0.55 → 0.65.
     */
    @Column(name = "infiltration_shallow_ratio")
    private Float infiltrationShallowRatio;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private CropSeasonStatus status = CropSeasonStatus.ACTIVE;

    // ===== Relationships =====

    @Builder.Default
    @OneToMany(mappedBy = "cropSeason", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DailyWaterBalance> dailyWaterBalances = new ArrayList<>();
}
