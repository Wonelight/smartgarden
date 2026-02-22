package com.example.smart_garden.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Where;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "users", uniqueConstraints = {
                @UniqueConstraint(name = "uk_users_username", columnNames = "username"),
                @UniqueConstraint(name = "uk_users_email", columnNames = "email")
})
@Where(clause = "deleted_at IS NULL")
public class User extends BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(length = 50, nullable = false)
        private String username;

        @Column(length = 255, nullable = false)
        private String password;

        @Column(length = 100)
        private String email;

        @Column(name = "full_name", length = 100)
        private String fullName;

        @Column(name = "is_active", nullable = false)
        private Boolean isActive = true;

        /**
         * Roles assigned to this user.
         * Many-to-many relationship with Role.
         */
        @ManyToMany(fetch = FetchType.EAGER)
        @JoinTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "role_id"))
        @Builder.Default
        private Set<Role> roles = new HashSet<>();

        // Relationships

        @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
        @Builder.Default
        private List<Device> devices = new ArrayList<>();

        @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = false)
        @Builder.Default
        private List<DeviceControl> deviceControls = new ArrayList<>();

        // Helper methods

        /**
         * Add a role to this user.
         */
        public void addRole(Role role) {
                roles.add(role);
                role.getUsers().add(this);
        }

        /**
         * Remove a role from this user.
         */
        public void removeRole(Role role) {
                roles.remove(role);
                role.getUsers().remove(this);
        }

        /**
         * Check if user has a specific role by name.
         */
        public boolean hasRole(String roleName) {
                return roles.stream()
                                .anyMatch(r -> r.getName().equals(roleName));
        }

        /**
         * Check if user has a specific permission.
         * Aggregates permissions from all assigned roles.
         */
        public boolean hasPermission(String permissionName) {
                return roles.stream()
                                .flatMap(role -> role.getPermissions().stream())
                                .anyMatch(permission -> permission.getName().equals(permissionName));
        }

        /**
         * Get all permissions for this user.
         * Aggregates permissions from all assigned roles.
         */
        public Set<Permission> getAllPermissions() {
                return roles.stream()
                                .flatMap(role -> role.getPermissions().stream())
                                .collect(Collectors.toSet());
        }
}
