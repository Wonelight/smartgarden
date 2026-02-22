package com.example.smart_garden.security;

/**
 * Tên role dùng trong Spring Security (hasRole).
 * Spring tự thêm prefix "ROLE_" khi so sánh với GrantedAuthority.
 */
public final class RbacRoles {

    public static final String ADMIN = "ADMIN";
    public static final String USER = "USER";

    private RbacRoles() {
    }

}
