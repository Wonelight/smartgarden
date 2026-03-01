import type { User } from '../types';

/**
 * Check if user has admin role.
 * Supports both:
 * - role: string (from JWT token, e.g., "ADMIN")
 * - roles: string[] (from API responses, e.g., ["ADMIN", "USER"])
 */
export const isAdmin = (user: User | null): boolean => {
    if (!user) {
        return false;
    }

    // Check roles array first (from API responses)
    if (user.roles && Array.isArray(user.roles)) {
        return user.roles.some(r => r.toUpperCase() === 'ADMIN' || r.toUpperCase().includes('ADMIN'));
    }

    // Fallback to single role (from JWT)
    if (user.role) {
        const role = user.role.toUpperCase();
        return role === 'ADMIN' || role.includes('ADMIN');
    }

    return false;
};

/**
 * Check if user has specific role
 */
export const hasRole = (user: User | null, roleName: string): boolean => {
    if (!user) {
        return false;
    }

    const targetRole = roleName.toUpperCase();

    // Check roles array first
    if (user.roles && Array.isArray(user.roles)) {
        return user.roles.some(r => r.toUpperCase() === targetRole);
    }

    // Fallback to single role
    if (user.role) {
        return user.role.toUpperCase() === targetRole;
    }

    return false;
};
