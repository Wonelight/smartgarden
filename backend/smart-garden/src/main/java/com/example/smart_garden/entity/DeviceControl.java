package com.example.smart_garden.entity;

import com.example.smart_garden.entity.enums.ControlAction;
import com.example.smart_garden.entity.enums.ControlInitiatedBy;
import com.example.smart_garden.entity.enums.ControlStatus;
import com.example.smart_garden.entity.enums.ControlType;
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
@Table(name = "device_control")
@Where(clause = "deleted_at IS NULL")
public class DeviceControl extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Enumerated(EnumType.STRING)
    @Column(name = "control_type", nullable = false, length = 20)
    private ControlType controlType;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20)
    private ControlAction action;

    @Column(name = "duration")
    private Integer duration;

    @Enumerated(EnumType.STRING)
    @Column(name = "initiated_by", length = 20)
    private ControlInitiatedBy initiatedBy = ControlInitiatedBy.SYSTEM;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private ControlStatus status = ControlStatus.PENDING;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;
}

