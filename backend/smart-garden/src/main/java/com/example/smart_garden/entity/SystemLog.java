package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "system_log",
        indexes = {
            @Index(name = "idx_system_log_created_level", columnList = "created_at, log_level")
        }
)
@Where(clause = "deleted_at IS NULL")
public class SystemLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private Device device;

    @Enumerated(EnumType.STRING)
    @Column(name = "log_level", nullable = false, length = 20)
    private LogLevel logLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "log_source", nullable = false, length = 20)
    private LogSource logSource;

    @Lob
    @Column(name = "message", nullable = false)
    private String message;

    @Lob
    @Column(name = "stack_trace")
    private String stackTrace;

    @Column(name = "metadata", columnDefinition = "json")
    private String metadata;

}

