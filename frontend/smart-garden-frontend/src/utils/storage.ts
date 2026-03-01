const TOKEN_KEY = 'smart_garden_token';
const REFRESH_TOKEN_KEY = 'smart_garden_refresh_token';
const USER_KEY = 'smart_garden_user';
const REMEMBER_ME_KEY = 'smart_garden_remember_me';
const SAVED_USERNAME_KEY = 'smart_garden_saved_username';
const PERSISTENT_STORAGE_FLAG = 'smart_garden_persistent';

const getStorage = (persistent: boolean) => (persistent ? localStorage : sessionStorage);

/** Đọc từ session trước (phiên hiện tại), nếu không có thì đọc từ localStorage (ghi nhớ) */
const getFromStorage = (key: string): string | null => {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
};

export const storage = {
    getToken: (): string | null => getFromStorage(TOKEN_KEY),

    setToken: (token: string, persistent = true): void => {
        if (persistent) localStorage.setItem(PERSISTENT_STORAGE_FLAG, '1');
        else localStorage.removeItem(PERSISTENT_STORAGE_FLAG);
        const store = getStorage(persistent);
        store.setItem(TOKEN_KEY, token);
        const other = persistent ? sessionStorage : localStorage;
        other.removeItem(TOKEN_KEY);
    },

    removeToken: (): void => {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    },

    getRefreshToken: (): string | null => getFromStorage(REFRESH_TOKEN_KEY),

    setRefreshToken: (refreshToken: string, persistent = true): void => {
        const store = getStorage(persistent);
        store.setItem(REFRESH_TOKEN_KEY, refreshToken);
        const other = persistent ? sessionStorage : localStorage;
        other.removeItem(REFRESH_TOKEN_KEY);
    },

    removeRefreshToken: (): void => {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    },

    getUser: (): any | null => {
        const raw = getFromStorage(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    setUser: (user: any, persistent = true): void => {
        const store = getStorage(persistent);
        store.setItem(USER_KEY, JSON.stringify(user));
        const other = persistent ? sessionStorage : localStorage;
        other.removeItem(USER_KEY);
    },

    removeUser: (): void => {
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(USER_KEY);
    },

    clear: (): void => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(PERSISTENT_STORAGE_FLAG);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
    },

    /** Dùng khi refresh token để ghi đúng storage (local vs session) */
    isPersistent: (): boolean => localStorage.getItem(PERSISTENT_STORAGE_FLAG) === '1',

    /** Lưu trạng thái ghi nhớ đăng nhập và username (chỉ dùng localStorage) */
    setRememberMeData: (rememberMe: boolean, username: string): void => {
        if (rememberMe) {
            localStorage.setItem(REMEMBER_ME_KEY, 'true');
            localStorage.setItem(SAVED_USERNAME_KEY, username);
        } else {
            localStorage.removeItem(REMEMBER_ME_KEY);
            localStorage.removeItem(SAVED_USERNAME_KEY);
        }
    },

    getRememberMe: (): boolean => localStorage.getItem(REMEMBER_ME_KEY) === 'true',

    getSavedUsername: (): string | null => localStorage.getItem(SAVED_USERNAME_KEY),
};
