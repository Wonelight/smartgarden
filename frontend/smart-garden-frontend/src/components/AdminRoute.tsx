import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * Route protection component for admin-only pages.
 * Redirects to dashboard if user is not authenticated or not an admin.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();

    // Debug logging
    React.useEffect(() => {
        console.log('[AdminRoute] Authenticated:', isAuthenticated);
        console.log('[AdminRoute] User:', user);
        console.log('[AdminRoute] Is Admin:', checkIsAdmin(user));
    }, [isAuthenticated, user]);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!checkIsAdmin(user)) {
        console.warn('[AdminRoute] Access denied - user is not admin');
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};
