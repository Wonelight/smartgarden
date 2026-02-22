package com.example.smart_garden.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình dữ liệu khởi tạo: tài khoản admin và user mặc định (chỉ tạo nếu chưa tồn tại).
 */
@ConfigurationProperties(prefix = "app.init")
@Getter
@Setter
public class InitDataProperties {

    /** Bật/tắt chạy seed khi khởi động. */
    private boolean enabled = true;

    private AdminUser admin = new AdminUser();
    private DefaultUser defaultUser = new DefaultUser();

    @Getter
    @Setter
    public static class AdminUser {
        private String username = "admin";
        private String password = "123456";
        private String email = "admin@smartgarden.local";
        private String fullName = "System Admin";
    }

    @Getter
    @Setter
    public static class DefaultUser {
        /** Có tạo user mặc định (role USER) hay không. */
        private boolean enabled = true;
        private String username = "user";
        private String password = "123456";
        private String email = "user@smartgarden.local";
        private String fullName = "Default User";
    }
}
