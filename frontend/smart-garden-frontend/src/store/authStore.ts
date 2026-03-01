import { create } from 'zustand';
import type { AuthState, User } from '../types';
import { storage } from '../utils/storage';
import { authApi } from '../api/auth';

export const useAuthStore = create<AuthState>((set) => ({
    user: storage.getUser(),
    token: storage.getToken(),
    isAuthenticated: !!storage.getToken(),

    login: async (username: string, password: string, rememberMe = true) => {
        try {
            const response = await authApi.login({ username, password });

            // Decode JWT to get basic user info
            const tokenParts = response.accessToken.split('.');
            const payload = JSON.parse(atob(tokenParts[1]));
            const role = payload.role || 'USER';

            // Store tokens - persistent (localStorage) khi ghi nhớ, session khi không
            storage.setToken(response.accessToken, rememberMe);
            storage.setRefreshToken(response.refreshToken, rememberMe);

            // Fetch full user profile to get roles array
            // We need to import userApi dynamically to avoid circular dependency
            const { userApi } = await import('../api/user');
            const profile = await userApi.getMyProfile();

            const user: User = {
                username: profile.username,
                role: role, // From JWT
                roles: profile.roles, // From API (array)
            };

            storage.setUser(user, rememberMe);
            storage.setRememberMeData(rememberMe, username);

            // Update state
            set({
                user,
                token: response.accessToken,
                isAuthenticated: true,
            });
        } catch (error) {
            storage.clear();
            set({
                user: null,
                token: null,
                isAuthenticated: false,
            });
            throw error;
        }
    },

    logout: () => {
        storage.clear();
        set({
            user: null,
            token: null,
            isAuthenticated: false,
        });
    },

    setAuth: (token: string, user: User) => {
        storage.setToken(token);
        storage.setUser(user);
        set({
            user,
            token,
            isAuthenticated: true,
        });
    },
}));
