import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
    Home, User, HelpCircle, X, LogOut, Users, Settings, Bell, ScrollText,
    Cpu, BarChart3, History, Sprout, Layers, Zap, Flower2, ScanSearch
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';

const TEAL = '#2DD4BF';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen: controlledOpen, onClose }) => {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const closeSidebar = onClose ?? (() => setInternalOpen(false));
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const isAdmin = checkIsAdmin(user);

    const handleLogout = () => {
        closeSidebar();
        logout();
        navigate('/login');
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={closeSidebar}
                    aria-hidden
                />
            )}

            {/* Sidebar panel - desktop: always visible; mobile: slide in when isOpen */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-[280px] max-w-[85vw] min-h-screen
                    bg-white border-r border-slate-200
                    flex flex-col overflow-x-hidden
                    transition-transform duration-200 ease-out
                    lg:translate-x-0
                    ${isOpen ? 'translate-x-0 shadow-sm' : '-translate-x-full'}
                `}
            >
                {/* Logo + close (mobile) */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100">
                    <Link
                        to="/dashboard"
                        onClick={closeSidebar}
                        className="font-bold flex items-center gap-2 text-lg"
                        style={{ color: TEAL }}
                    >
                        <span className="text-2xl">🌿</span>
                        SmartGarden
                    </Link>
                    <button
                        type="button"
                        className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-sm"
                        onClick={closeSidebar}
                        aria-label="Đóng menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-6" aria-label="Sidebar">
                    {/* Dashboard */}
                    <div>
                        <NavLink
                            to="/dashboard"
                            onClick={closeSidebar}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }
                            `}
                        >
                            <Home className="w-5 h-5 shrink-0" />
                            Dashboard
                        </NavLink>
                    </div>

                    {/* Management */}
                    <div>
                        <div className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Quản lý
                        </div>
                        <div className="space-y-1">
                            <NavLink
                                to="/devices"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <Cpu className="w-5 h-5 shrink-0" />
                                Thiết bị của tôi
                            </NavLink>
                            <NavLink
                                to="/monitoring"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <BarChart3 className="w-5 h-5 shrink-0" />
                                Giám sát
                            </NavLink>
                        </div>
                    </div>

                    {/* Garden Config */}
                    <div>
                        <div className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Vườn của tôi
                        </div>
                        <div className="space-y-1">
                            <NavLink
                                to="/garden-config"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <Flower2 className="w-5 h-5 shrink-0" />
                                Cấu hình vườn
                            </NavLink>
                        </div>
                    </div>

                    {/* Automation */}
                    <div>
                        <div className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Tự động hóa
                        </div>
                        <div className="space-y-1">
                            <NavLink
                                to="/automation"
                                end={false}
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <Zap className="w-5 h-5 shrink-0" />
                                Tự động hóa
                            </NavLink>
                            <NavLink
                                to="/irrigation-history"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <History className="w-5 h-5 shrink-0" />
                                Lịch sử
                            </NavLink>
                            <NavLink
                                to="/plant-diagnosis"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <ScanSearch className="w-5 h-5 shrink-0" />
                                Chẩn đoán bệnh cây
                            </NavLink>
                        </div>
                    </div>

                    {isAdmin && (
                        <div>
                            <div className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Quản trị
                            </div>
                            <div className="space-y-1">
                                <NavLink
                                    to="/admin/users"
                                    onClick={closeSidebar}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                    `}
                                >
                                    <Users className="w-5 h-5 shrink-0" />
                                    Người dùng
                                </NavLink>
                                <NavLink
                                    to="/admin/devices"
                                    onClick={closeSidebar}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                    `}
                                >
                                    <Cpu className="w-5 h-5 shrink-0" />
                                    Thiết bị
                                </NavLink>
                                <NavLink
                                    to="/admin/crop-libraries"
                                    onClick={closeSidebar}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                    `}
                                >
                                    <Sprout className="w-5 h-5 shrink-0" />
                                    Cây trồng
                                </NavLink>
                                <NavLink
                                    to="/admin/soil-libraries"
                                    onClick={closeSidebar}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                    `}
                                >
                                    <Layers className="w-5 h-5 shrink-0" />
                                    Loại đất
                                </NavLink>
                            </div>
                        </div>
                    )}

                    {/* System */}
                    <div>
                        <div className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Hệ thống
                        </div>
                        <div className="space-y-1">
                            <NavLink
                                to="/notifications"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <Bell className="w-5 h-5 shrink-0" />
                                Thông báo
                            </NavLink>
                            <NavLink
                                to="/logs"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <ScrollText className="w-5 h-5 shrink-0" />
                                Nhật ký
                            </NavLink>
                            <NavLink
                                to="/settings"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <Settings className="w-5 h-5 shrink-0" />
                                Cài đặt
                            </NavLink>
                            <NavLink
                                to="/profile"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <User className="w-5 h-5 shrink-0" />
                                Tài khoản
                            </NavLink>
                            <NavLink
                                to="/support"
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <HelpCircle className="w-5 h-5 shrink-0" />
                                Hỗ trợ
                            </NavLink>
                        </div>
                    </div>
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-sm text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        Đăng xuất
                    </button>
                </div>
            </aside>
        </>
    );
};
