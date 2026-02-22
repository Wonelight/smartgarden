package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "crop_library", uniqueConstraints = {
        @UniqueConstraint(name = "uk_crop_library_name", columnNames = "name")
})
@Where(clause = "deleted_at IS NULL")
public class CropLibrary extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    // ===== Crop Coefficients (Kc) by growth stage =====

    @Column(name = "kc_ini", nullable = false)
    private Float kcIni;

    @Column(name = "kc_mid", nullable = false)
    private Float kcMid;

    @Column(name = "kc_end", nullable = false)
    private Float kcEnd;

    // ===== Growth stage durations (days) =====

    @Column(name = "stage_ini_days", nullable = false)
    private Integer stageIniDays;

    @Column(name = "stage_dev_days", nullable = false)
    private Integer stageDevDays;

    @Column(name = "stage_mid_days", nullable = false)
    private Integer stageMidDays;

    @Column(name = "stage_end_days", nullable = false)
    private Integer stageEndDays;

    // ===== Root and depletion properties =====

    @Column(name = "max_root_depth", nullable = false)
    private Float maxRootDepth;

    @Column(name = "depletion_fraction", nullable = false)
    private Float depletionFraction;
}
