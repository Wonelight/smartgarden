package com.example.smart_garden.config;

import com.example.smart_garden.entity.Role;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.repository.RoleRepository;
import com.example.smart_garden.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seed dữ liệu cơ bản khi khởi động: tài khoản admin và user mặc định (nếu chưa
 * tồn tại).
 * Role và Permission được khởi tạo bởi RbacDataLoader.
 */
@Slf4j
@Component
@Order(1)
public class DataInitializer implements CommandLineRunner {

    private final InitDataProperties initDataProperties;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            InitDataProperties initDataProperties,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.initDataProperties = initDataProperties;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!initDataProperties.isEnabled()) {
            log.info("Init data is disabled (app.init.enabled=false). Skip seeding.");
            return;
        }

        String adminUsername = initDataProperties.getAdmin().getUsername();
        if (adminUsername != null && !adminUsername.isBlank() && userRepository.existsByUsername(adminUsername)) {
            log.info("Init data already applied (admin '{}' exists). Skip seeding.", adminUsername);
            return;
        }

        log.info("Initializing base data: roles/permissions (in-code), default accounts (DB)...");

        // Role & Permission: initialized by RbacDataLoader (DB seed)
        log.debug("Roles and Permissions should be initialized by RbacDataLoader.");

        seedAdminIfNeeded();
        seedDefaultUserIfNeeded();

        log.info("Init data finished.");
    }

    private void seedAdminIfNeeded() {
        InitDataProperties.AdminUser config = initDataProperties.getAdmin();
        String username = config.getUsername();
        if (username == null || username.isBlank()) {
            log.warn("app.init.admin.username is blank. Skip creating admin.");
            return;
        }

        if (userRepository.existsByUsername(username)) {
            log.debug("Admin user '{}' already exists. Skip.", username);
            return;
        }

        User admin = User.builder()
                .username(username)
                .password(passwordEncoder.encode(config.getPassword()))
                .email(config.getEmail() != null ? config.getEmail() : username + "@smartgarden.local")
                .fullName(config.getFullName() != null ? config.getFullName() : "System Admin")
                .isActive(true)
                .build();

        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseThrow(() -> new RuntimeException("ADMIN role not found"));
        admin.addRole(adminRole);

        userRepository.save(admin);
        log.info("Created initial admin account: username='{}', email='{}'. Change password after first login.",
                admin.getUsername(), admin.getEmail());
    }

    private void seedDefaultUserIfNeeded() {
        InitDataProperties.DefaultUser config = initDataProperties.getDefaultUser();
        if (!config.isEnabled()) {
            log.debug("Default user is disabled (app.init.default-user.enabled=false). Skip.");
            return;
        }

        String username = config.getUsername();
        if (username == null || username.isBlank()) {
            log.warn("app.init.default-user.username is blank. Skip creating default user.");
            return;
        }

        if (userRepository.existsByUsername(username)) {
            log.debug("Default user '{}' already exists. Skip.", username);
            return;
        }

        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(config.getPassword()))
                .email(config.getEmail() != null ? config.getEmail() : username + "@smartgarden.local")
                .fullName(config.getFullName() != null ? config.getFullName() : "Default User")
                .isActive(true)
                .build();

        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RuntimeException("USER role not found"));
        user.addRole(userRole);

        userRepository.save(user);
        log.info("Created default user account: username='{}', email='{}'. Change password after first login.",
                user.getUsername(), user.getEmail());
    }
}
