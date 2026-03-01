export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresInMs: number;
}

export interface RegisterRequest {
    username: string;
    password: string;
    /** Tùy chọn; nếu không có ô email trên form thì gửi null/undefined. */
    email?: string | null;
    fullName?: string;
}

export interface RegisterResponse {
    id: number;
    username: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ForgotPasswordResponse {
    message: string;
}

export interface ResetPasswordRequest {
    email: string;
    code: string;
    newPassword: string;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
    timestamp?: string;
}

export interface User {
    username: string;
    role: string; // From JWT token (single role string)
    roles?: string[]; // From API responses (array of roles)
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
    logout: () => void;
    setAuth: (token: string, user: User) => void;
}
