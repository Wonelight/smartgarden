package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.util.HashSet;
import java.util.Set;

/**
 * Permission entity representing individual permissions in the RBAC system.
 * Permissions define what actions can be performed (e.g., DEVICE_VIEW_OWN, USER_CREATE).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "permissions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_permissions_name", columnNames = "name")
        }
)
@Where(clause = "deleted_at IS NULL")
public class Permission extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Unique permission name (e.g., DEVICE_VIEW_OWN, USER_CREATE).
     * This matches the authority string used in Spring Security.
     */
    @Column(name = "name", length = 100, nullable = false, unique = true)
    private String name;

    /**
     * Human-readable description of what this permission allows.
     */
    @Column(name = "description", length = 255)
    private String description;

    /**
     * Category grouping for permissions (e.g., DEVICE, USER, CONTROL, IRRIGATION).
     * Used for organizing permissions in the UI.
     */
    @Column(name = "category", length = 50)
    private String category;

    /**
     * Roles that have this permission.
     * Many-to-many relationship managed by the Role entity.
     */
    @ManyToMany(mappedBy = "permissions", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Permission)) return false;
        Permission that = (Permission) o;
        return name != null && name.equals(that.name);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
