/**
 * User profile types for self and admin management
 */

// ================== ROLE (for admin create user) ==================

export interface RoleListItem {
    id: number;
    name: string;
    description?: string | null;
    isSystem?: boolean;
    permissionCount?: number;
}

// ================== SELF (User) ==================

export interface UserProfile {
    id: number;
    username: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
}

export interface UpdateProfileRequest {
    email?: string;
    fullName?: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

// ================== ADMIN ==================

export interface AdminUserListItem {
    id: number;
    username: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminUserDetail {
    id: number;
    username: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminCreateUserRequest {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    /** Tên role (vd: USER, ADMIN). Mặc định USER nếu không gửi. */
    role?: string;
}

export interface AdminUpdateUserRequest {
    email?: string;
    fullName?: string;
    /** Tên role (vd: USER, ADMIN). */
    role?: string;
    isActive?: boolean;
}
