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
@Table(name = "soil_library", uniqueConstraints = {
        @UniqueConstraint(name = "uk_soil_library_name", columnNames = "name")
})
@Where(clause = "deleted_at IS NULL")
public class SoilLibrary extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "field_capacity", nullable = false)
    private Float fieldCapacity;

    @Column(name = "wilting_point", nullable = false)
    private Float wiltingPoint;

    /**
     * Tỷ lệ nước mưa/tưới vào tầng nông (0-1). Phần còn lại vào tầng sâu.
     * Phụ thuộc loại đất: cát thấm sâu (≈0.55), sét giữ bề mặt (≈0.80).
     * Null = dùng mặc định 0.70 (đất thịt).
     */
    @Column(name = "infiltration_shallow_ratio")
    private Float infiltrationShallowRatio;
}
