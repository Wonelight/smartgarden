package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "daily_water_balance", uniqueConstraints = {
        @UniqueConstraint(name = "uk_daily_water_balance_season_date", columnNames = { "season_id", "date" })
}, indexes = {
        @Index(name = "idx_daily_water_balance_season_date", columnList = "season_id, date")
})
@Where(clause = "deleted_at IS NULL")
public class DailyWaterBalance extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "season_id", nullable = false)
    private CropSeason cropSeason;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "crop_age", nullable = false)
    private Integer cropAge;

    @Column(name = "et0_value")
    private Float et0Value;

    @Column(name = "kc_current")
    private Float kcCurrent;

    @Column(name = "etc_value")
    private Float etcValue;

    @Column(name = "effective_rain")
    private Float effectiveRain;

    @Column(name = "irrigation_amount")
    private Float irrigationAmount;

    @Column(name = "dc_value")
    private Float dcValue;

    @Column(name = "recommendation", columnDefinition = "TEXT")
    private String recommendation;
}
