package com.example.smart_garden.config;

import com.example.smart_garden.entity.Permission;
import com.example.smart_garden.entity.Role;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.repository.PermissionRepository;
import com.example.smart_garden.repository.RoleRepository;
import com.example.smart_garden.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Data loader for initializing default permissions, roles, and migrating
 * existing users.
 * Runs on application startup.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@org.springframework.core.annotation.Order(0)
public class RbacDataLoader implements CommandLineRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        log.info("Starting RBAC data initialization...");

        if (roleRepository.existsByName("ADMIN") && permissionRepository.count() > 0) {
            log.info("RBAC data already initialized. Skip.");
            return;
        }

        // Step 1: Initialize permissions from RbacPermission enum
        Map<String, Permission> permissionMap = initializePermissions();

        // Step 2: Initialize default roles (ADMIN, USER)
        initializeRoles(permissionMap);

        // Step 3: Migrate existing users to new role system
        migrateExistingUsers();

        log.info("RBAC data initialization completed successfully");
    }

    /**
     * Create permission records from internal definition if they don't exist.
     *
     * @return Map of permission name to Permission entity
     */
    private Map<String, Permission> initializePermissions() {
        log.info("Initializing permissions...");

        Map<String, String> permissionData = getAllPermissions();
        Map<String, Permission> permissionMap = new HashMap<>();

        for (Map.Entry<String, String> entry : permissionData.entrySet()) {
            String permissionName = entry.getKey();
            String description = entry.getValue();

            Permission permission = permissionRepository.findByName(permissionName)
                    .orElse(null);

            if (permission == null) {
                // Extract category from permission name (e.g., DEVICE_VIEW_OWN -> DEVICE)
                String category = extractCategory(permissionName);

                permission = Permission.builder()
                        .name(permissionName)
                        .description(description)
                        .category(category)
                        .build();

                permission = permissionRepository.save(permission);
                log.debug("Created permission: {}", permissionName);
            }

            permissionMap.put(permissionName, permission);
        }

        log.info("Initialized {} permissions", permissionMap.size());
        return permissionMap;
    }

    private Map<String, String> getAllPermissions() {
        Map<String, String> p = new LinkedHashMap<>();

        // Device
        p.put("DEVICE_VIEW_OWN", "View own devices");
        p.put("DEVICE_EDIT_OWN", "Edit own devices");
        p.put("DEVICE_CREATE", "Create devices (Admin)");
        p.put("DEVICE_VIEW_ALL", "View all devices (Admin)");
        p.put("DEVICE_EDIT_ANY", "Edit any devices (Admin)");
        p.put("DEVICE_DELETE", "Delete devices (Admin)");

        // Control
        p.put("CONTROL_SEND", "Send device controls");
        p.put("CONTROL_VIEW", "View control history");
        p.put("CONTROL_UPDATE_STATUS", "Update control status");

        // Irrigation
        p.put("IRRIGATION_VIEW_CONFIG", "View irrigation config");
        p.put("IRRIGATION_EDIT_OWN_CONFIG", "Edit own irrigation config");
        p.put("IRRIGATION_EDIT_ANY_CONFIG", "Edit any irrigation config (Admin)");
        p.put("IRRIGATION_VIEW_HISTORY", "View irrigation history");

        // Schedule
        p.put("SCHEDULE_VIEW", "View schedules");
        p.put("SCHEDULE_CREATE", "Create schedules");
        p.put("SCHEDULE_EDIT", "Edit schedules");
        p.put("SCHEDULE_DELETE", "Delete schedules");
        p.put("SCHEDULE_TOGGLE_ACTIVE", "Toggle schedule active status");

        // Sensor
        p.put("SENSOR_VIEW", "View sensor data");
        p.put("SENSOR_DELETE_OLD", "Delete old sensor data");

        // User
        p.put("USER_REGISTER", "User self registration");
        p.put("USER_VIEW_OWN", "View own profile");
        p.put("USER_EDIT_OWN", "Edit own profile");
        p.put("USER_CHANGE_PASSWORD", "Change own password");
        p.put("USER_CREATE", "Create users (Admin)");
        p.put("USER_VIEW_ALL", "View all users (Admin)");
        p.put("USER_EDIT_ANY", "Edit any users (Admin)");
        p.put("USER_DELETE", "Delete users (Admin)");

        return p;
    }

    /**
     * Create default roles (ADMIN, USER) with their permissions.
     *
     * @param permissionMap Map of all available permissions
     */
    private void initializeRoles(Map<String, Permission> permissionMap) {
        log.info("Initializing roles...");

        // Define role-permission mappings (based on old RolePermissionRegistry)
        Map<String, Set<String>> rolePermissions = getRolePermissionMappings();

        for (Map.Entry<String, Set<String>> entry : rolePermissions.entrySet()) {
            String roleName = entry.getKey();
            Set<String> permissionNames = entry.getValue();

            Role role = roleRepository.findByName(roleName).orElse(null);

            if (role == null) {
                // Create new role
                Set<Permission> permissions = permissionNames.stream()
                        .map(permissionMap::get)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());

                role = Role.builder()
                        .name(roleName)
                        .description(getRoleDescription(roleName))
                        .isSystem(true) // Mark as system role
                        .permissions(permissions)
                        .build();

                role = roleRepository.save(role);
                log.info("Created role: {} with {} permissions", roleName, permissions.size());
            } else {
                log.debug("Role already exists: {}", roleName);
            }
        }

        log.info("Roles initialization completed");
    }

    /**
     * Migrate existing users from old UserRole enum system to new Role entity
     * system.
     */
    private void migrateExistingUsers() {
        log.info("Migrating existing users to new role system...");

        List<User> allUsers = userRepository.findAll();
        int migratedCount = 0;

        for (User user : allUsers) {
            // Check if user already has roles assigned
            if (user.getRoles().isEmpty()) {
                // Migration logic would go here if we had the old role field
                // Since we already removed it, we'll assign USER role by default
                Role userRole = roleRepository.findByName("USER")
                        .orElseThrow(() -> new RuntimeException("USER role not found"));

                user.addRole(userRole);
                userRepository.save(user);
                migratedCount++;
                log.debug("Assigned USER role to user: {}", user.getUsername());
            }
        }

        log.info("Migrated {} users to new role system", migratedCount);
    }

    /**
     * Extract category from permission name.
     */
    private String extractCategory(String permissionName) {
        int underscoreIndex = permissionName.indexOf('_');
        if (underscoreIndex > 0) {
            return permissionName.substring(0, underscoreIndex);
        }
        return "OTHER";
    }

    /**
     * Get description for a role.
     */
    private String getRoleDescription(String roleName) {
        return switch (roleName) {
            case "ADMIN" -> "System administrator with full access";
            case "USER" -> "Regular user with limited access";
            default -> "Custom role";
        };
    }

    /**
     * Define role-permission mappings.
     * This mirrors the old RolePermissionRegistry logic.
     */
    private Map<String, Set<String>> getRolePermissionMappings() {
        Map<String, Set<String>> mappings = new HashMap<>();

        // USER role permissions
        mappings.put("USER", Set.of(
                "DEVICE_VIEW_OWN",
                "DEVICE_EDIT_OWN",
                "CONTROL_SEND",
                "CONTROL_VIEW",
                "CONTROL_UPDATE_STATUS",
                "IRRIGATION_VIEW_CONFIG",
                "IRRIGATION_EDIT_OWN_CONFIG",
                "IRRIGATION_VIEW_HISTORY",
                "SCHEDULE_VIEW",
                "SCHEDULE_CREATE",
                "SCHEDULE_EDIT",
                "SCHEDULE_DELETE",
                "SCHEDULE_TOGGLE_ACTIVE",
                "SENSOR_VIEW",
                "SENSOR_DELETE_OLD",
                "USER_VIEW_OWN",
                "USER_EDIT_OWN",
                "USER_CHANGE_PASSWORD"));

        // ADMIN role permissions (all permissions from USER + additional admin
        // permissions)
        Set<String> adminPermissions = new HashSet<>(mappings.get("USER"));
        adminPermissions.addAll(Set.of(
                "DEVICE_CREATE",
                "DEVICE_VIEW_ALL",
                "DEVICE_EDIT_ANY",
                "DEVICE_DELETE",
                "IRRIGATION_EDIT_ANY_CONFIG",
                "USER_CREATE",
                "USER_VIEW_ALL",
                "USER_EDIT_ANY",
                "USER_DELETE"));
        mappings.put("ADMIN", adminPermissions);

        return mappings;
    }
}
