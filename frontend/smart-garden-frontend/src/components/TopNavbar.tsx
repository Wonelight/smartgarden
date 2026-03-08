import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Settings, Bell, UserCircle, Users, LogOut, Smartphone, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from './Dropdown';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';
import { useQuery } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { useMonitoringDevice } from '../contexts/MonitoringDeviceContext';
import * as Select from '@radix-ui/react-select';

const BREADCRUMB_MAP: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/monitoring': 'Giám sát',
    '/profile': 'Profile',
    '/settings': 'Cài đặt',
    '/notifications': 'Thông báo',
    '/logs': 'Nhật ký hệ thống',
    '/support': 'Hỗ trợ',
    '/admin/users': 'Quản lý người dùng',
    '/debug': 'Debug',
};

function getBreadcrumbs(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    const last = '/' + segments.join('/');
    return BREADCRUMB_MAP[last] ?? segments[segments.length - 1];
}

interface TopNavbarProps {
    onOpenSidebar?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenSidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const isAdmin = checkIsAdmin(user);
    const breadcrumbText = getBreadcrumbs(location.pathname);
    const { selectedDeviceId, setSelectedDeviceId } = useMonitoringDevice();
    const { data: userDevices = [] } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
    });
    useEffect(() => {
        if (userDevices.length > 0 && selectedDeviceId === null) {
            setSelectedDeviceId(userDevices[0].id);
        }
    }, [userDevices, selectedDeviceId, setSelectedDeviceId]);

    const currentDevice = userDevices.find((d) => d.id === selectedDeviceId) ?? userDevices[0] ?? null;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <button
                    type="button"
                    className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-sm shrink-0"
                    onClick={onOpenSidebar}
                    aria-label="Mở menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <nav aria-label="breadcrumb" className="text-sm text-slate-600 truncate shrink-0">
                    <span>Pages</span>
                    <span className="mx-1.5">/</span>
                    <span className="font-medium text-slate-900">{breadcrumbText}</span>
                </nav>
                {userDevices.length > 0 && (
                    <div className="hidden sm:flex items-center gap-2 min-w-0 ml-2">
                        {currentDevice && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl shrink-0 ${currentDevice.status === 'ONLINE' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                <div className={`w-2 h-2 rounded-full ${currentDevice.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                <span className={`text-[11px] font-bold tracking-wide uppercase ${currentDevice.status === 'ONLINE' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {currentDevice.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                        )}
                        <Smartphone className="w-4 h-4 text-slate-500 shrink-0" />
                        <Select.Root
                            value={selectedDeviceId != null ? String(selectedDeviceId) : ''}
                            onValueChange={(v) => setSelectedDeviceId(v ? Number(v) : null)}
                        >
                            <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 min-w-0 max-w-[220px]">
                                <Select.Value placeholder="Chọn thiết bị...">
                                    <span className="block truncate text-left">
                                        {currentDevice ? currentDevice.deviceName : 'Chọn thiết bị...'}
                                    </span>
                                </Select.Value>
                                <Select.Icon>
                                    <ChevronDown className="w-4 h-4 shrink-0" />
                                </Select.Icon>
                            </Select.Trigger>
                            <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-[280px]">
                                    <Select.Viewport className="p-1">
                                        <Select.Group>
                                            <Select.Label className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                                                Thiết bị được chọn
                                            </Select.Label>
                                            {userDevices.map((d) => (
                                                <Select.Item
                                                    key={d.id}
                                                    value={String(d.id)}
                                                    className="relative flex items-center px-3 py-2 text-sm text-slate-700 rounded-lg cursor-pointer hover:bg-teal-50 focus:bg-teal-50 focus:outline-none data-[highlighted]:bg-teal-50"
                                                >
                                                    <Select.ItemText>
                                                        <div className="flex items-center truncate">
                                                            <span className="font-medium truncate">{d.deviceName}</span>
                                                            {d.location && <span className="text-slate-500 ml-1 truncate shrink-0">· {d.location}</span>}
                                                        </div>
                                                    </Select.ItemText>
                                                </Select.Item>
                                            ))}
                                        </Select.Group>
                                    </Select.Viewport>
                                </Select.Content>
                            </Select.Portal>
                        </Select.Root>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="hidden sm:block relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Type here..."
                        className="w-48 lg:w-56 pl-9 pr-3 py-2 rounded-sm border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                </div>
                <Link
                    to="/settings"
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Cài đặt"
                >
                    <Settings className="w-5 h-5" />
                </Link>
                <Link
                    to="/notifications"
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-sm transition-colors relative"
                    aria-label="Thông báo"
                >
                    <Bell className="w-5 h-5" />
                </Link>
                <div className="ml-1">
                    {isAdmin ? (
                        <Dropdown triggerLabel="Tài khoản">
                            <Dropdown.LinkItem to="/profile" icon={<UserCircle className="w-4 h-4" />}>
                                Thông tin cá nhân
                            </Dropdown.LinkItem>
                            <Dropdown.LinkItem to="/admin/users" icon={<Users className="w-4 h-4" />}>
                                Quản lý người dùng
                            </Dropdown.LinkItem>
                            <Dropdown.Item icon={<LogOut className="w-4 h-4" />} onClick={handleLogout} variant="danger">
                                Đăng xuất
                            </Dropdown.Item>
                        </Dropdown>
                    ) : (
                        <Dropdown triggerLabel="Tài khoản">
                            <Dropdown.LinkItem to="/profile" icon={<UserCircle className="w-4 h-4" />}>
                                Thông tin cá nhân
                            </Dropdown.LinkItem>
                            <Dropdown.Item icon={<LogOut className="w-4 h-4" />} onClick={handleLogout} variant="danger">
                                Đăng xuất
                            </Dropdown.Item>
                        </Dropdown>
                    )}
                </div>
            </div>
        </header>
    );
};
