import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, LogOut, Settings, UserCircle, X, ChevronDown, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from './Dropdown';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';

export const Header: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [isAccountOpen, setIsAccountOpen] = React.useState(false);
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if user is admin
    const isAdmin = checkIsAdmin(user);

    // Debug logging
    React.useEffect(() => {
        console.log('[Header] User:', user);
        console.log('[Header] Is Admin:', isAdmin);
    }, [user, isAdmin]);

    const navItems = [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
    ];

    const closeSidebar = () => setIsMobileMenuOpen(false);

    const handleLogout = () => {
        closeSidebar();
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-50 w-full h-16 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between h-full w-full max-w-[1600px] mx-auto px-2 sm:px-3 md:px-4 lg:px-5">
                {/* Left: Logo */}
                <div className="flex items-center">
                    <Link to="/dashboard" className="text-xl font-bold text-emerald-600 tracking-tight flex items-center gap-2">
                        <span className="text-2xl">🌿</span> SmartGarden
                    </Link>
                </div>

                {/* Right: Navigation & Actions */}
                <div className="flex items-center gap-6 lg:gap-8">
                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `text-sm font-medium transition-colors hover:text-emerald-600 ${isActive ? 'text-emerald-600' : 'text-slate-600'
                                    }`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Desktop: Account Menu */}
                    <div className="hidden md:block">
                        {isAdmin ? (
                            // Admin: Dropdown with Profile and User Management
                            <Dropdown triggerLabel="Tài khoản">
                                <Dropdown.LinkItem to="/profile" icon={<UserCircle className="w-4 h-4" />}>
                                    Thông tin cá nhân
                                </Dropdown.LinkItem>
                                <Dropdown.LinkItem to="/admin/users" icon={<Users className="w-4 h-4" />}>
                                    Quản lý người dùng
                                </Dropdown.LinkItem>
                                <Dropdown.LinkItem to="/settings" icon={<Settings className="w-4 h-4" />}>
                                    Cài đặt
                                </Dropdown.LinkItem>
                                <Dropdown.Item icon={<LogOut className="w-4 h-4" />} onClick={handleLogout} variant="danger">
                                    Đăng xuất
                                </Dropdown.Item>
                            </Dropdown>
                        ) : (
                            // Regular User: Simple Profile dropdown
                            <Dropdown triggerLabel="Tài khoản">
                                <Dropdown.LinkItem to="/profile" icon={<UserCircle className="w-4 h-4" />}>
                                    Thông tin cá nhân
                                </Dropdown.LinkItem>
                                <Dropdown.LinkItem to="/settings" icon={<Settings className="w-4 h-4" />}>
                                    Cài đặt
                                </Dropdown.LinkItem>
                                <Dropdown.Item icon={<LogOut className="w-4 h-4" />} onClick={handleLogout} variant="danger">
                                    Đăng xuất
                                </Dropdown.Item>
                            </Dropdown>
                        )}
                    </div>

                    {/* Mobile: Hamburger */}
                    <button
                        className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Mobile: Overlay (only when sidebar open) */}
            {isMobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40"
                    onClick={closeSidebar}
                    aria-hidden
                />
            )}

            {/* Mobile: Sidebar from left */}
            <aside
                className="md:hidden fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] bg-white border-r border-slate-200 shadow-xl flex flex-col overflow-x-hidden transition-transform duration-200 ease-out"
                style={{ transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)' }}
            >
                <div className="flex items-center justify-between h-16 px-4">
                    <Link to="/dashboard" onClick={closeSidebar} className="font-bold text-emerald-600 flex items-center gap-2">
                        <span className="text-xl">🌿</span> SmartGarden
                    </Link>
                    <button
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        onClick={closeSidebar}
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 flex flex-col min-h-0 py-4 px-4">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex px-4 py-3 text-sm font-medium rounded-lg transition-colors -mx-4 ${isActive
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`
                                }
                                onClick={closeSidebar}
                            >
                                {item.label}
                            </NavLink>
                        ))}

                        <button
                            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors -mx-4 outline-none focus:outline-none focus:ring-0 border-0"
                            onClick={() => setIsAccountOpen(!isAccountOpen)}
                        >
                            <span>Tài khoản</span>
                            <ChevronDown
                                className={`w-4 h-4 text-slate-400 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {isAccountOpen && (
                            <div className="space-y-0.5">
                                <Link
                                    to="/profile"
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
                                    onClick={closeSidebar}
                                >
                                    <UserCircle className="w-4 h-4" />
                                    Thông tin cá nhân
                                </Link>
                                {isAdmin && (
                                    <Link
                                        to="/admin/users"
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
                                        onClick={closeSidebar}
                                    >
                                        <Users className="w-4 h-4" />
                                        Quản lý người dùng
                                    </Link>
                                )}
                                <Link
                                    to="/settings"
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
                                    onClick={closeSidebar}
                                >
                                    <Settings className="w-4 h-4" />
                                    Cài đặt
                                </Link>
                            </div>
                        )}
                    </div>

                    <button
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-auto"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                    </button>
                </nav>
            </aside>
        </header>
    );
};

