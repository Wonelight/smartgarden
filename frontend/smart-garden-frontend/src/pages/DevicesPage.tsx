import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Wifi, WifiOff, AlertTriangle, Search, Plus, Pencil, Trash2,
    MapPin, Cpu, X, Users, Package, Loader2,
    Plug, BarChart3, Settings2, CalendarDays, MoreVertical, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import type { UserDeviceListItem, AdminDeviceListItem, AdminCreateDeviceRequest, AdminUpdateDeviceRequest } from '../api/device';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { ProgressIllusion } from '../components/ui/ProgressBar';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { Dropdown } from '../components/Dropdown';

// ============================================
// STATUS HELPERS
// ============================================

const statusConfig = {
    ONLINE: { label: 'Online', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: Wifi },
    OFFLINE: { label: 'Offline', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: WifiOff },
    ERROR: { label: 'Lỗi', color: 'bg-red-50 text-red-600', dot: 'bg-red-500', icon: AlertTriangle },
};

// ============================================
// DEVICE CARD COMPONENT
// ============================================

const DeviceCard: React.FC<{ device: UserDeviceListItem }> = ({ device }) => {
    const cfg = statusConfig[device.status] || statusConfig.OFFLINE;
    const StatusIcon = cfg.icon;
    const formattedDate = device.lastOnline
        ? new Date(device.lastOnline).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'Chưa kết nối';

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 shrink-0">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800 truncate">{device.deviceName}</h3>
                            <p className="text-xs text-slate-400 font-mono truncate">{device.deviceCode}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                        </span>
                        <Dropdown
                            align="end"
                            sideOffset={6}
                            trigger={
                                <button
                                    type="button"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 outline-none focus:ring-2 focus:ring-teal-500/30"
                                    aria-label="Thêm thao tác"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            }
                        >
                            <Dropdown.LinkItem to={`/devices/${device.id}`} icon={<FileText className="w-4 h-4" />}>Chi tiết</Dropdown.LinkItem>
                            <Dropdown.LinkItem to="/monitoring" state={{ deviceId: device.id }} icon={<BarChart3 className="w-4 h-4" />}>Giám sát</Dropdown.LinkItem>
                            <Dropdown.LinkItem to="/irrigation-config" icon={<Settings2 className="w-4 h-4" />}>Cấu hình tưới</Dropdown.LinkItem>
                            <Dropdown.LinkItem to="/schedules" icon={<CalendarDays className="w-4 h-4" />}>Lịch tưới</Dropdown.LinkItem>
                        </Dropdown>
                    </div>
                </div>

                <div className="min-h-[3.5rem] space-y-2 text-sm text-slate-500">
                    {device.location ? (
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{device.location}</span>
                        </div>
                    ) : (
                        <div className="h-5" aria-hidden />
                    )}
                    {(device.latitude != null && device.longitude != null) && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 pl-6">
                            <span>{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                        </div>
                    )}
                    <p className="text-xs text-slate-400 pl-6">Kết nối lần cuối: {formattedDate}</p>
                </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 rounded-b-2xl space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-slate-400 text-xs">Mã thiết bị</span>
                        <p className="font-mono text-slate-700">{device.deviceCode}</p>
                    </div>
                    <div>
                        <span className="text-slate-400 text-xs">Trạng thái</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className="text-slate-700">{cfg.label}</span>
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-400 text-xs">Vị trí</span>
                        <p className="text-slate-700">{device.location || '—'}</p>
                        {(device.latitude && device.longitude) && (
                            <p className="text-slate-500 text-xs mt-1">
                                Lat: {device.latitude}<br />Lon: {device.longitude}<br />Alt: {device.altitude || 0}m
                            </p>
                        )}
                    </div>
                    <div>
                        <span className="text-slate-400 text-xs">Kết nối cuối</span>
                        <p className="text-slate-700">{formattedDate}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    <Link
                        to={`/devices/${device.id}`}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 min-h-[2.25rem]"
                    >
                        Chi tiết thiết bị
                    </Link>
                    <Link
                        to="/monitoring"
                        state={{ deviceId: device.id }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"
                    >
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" /> Giám sát
                    </Link>
                    <Link
                        to="/irrigation-config"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"
                    >
                        <Settings2 className="w-3.5 h-3.5 shrink-0" /> Cấu hình tưới
                    </Link>
                    <Link
                        to="/schedules"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"
                    >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Lịch tưới
                    </Link>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ADMIN DEVICE TABLE
// ============================================

const AdminDeviceTable: React.FC<{
    devices: AdminDeviceListItem[];
    onEdit: (d: AdminDeviceListItem) => void;
    onDelete: (id: number) => void;
}> = ({ devices, onEdit, onDelete }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Thiết bị</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Mã</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Vị trí</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Trạng thái</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Firmware</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Người dùng</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {devices.map((d) => {
                        const cfg = statusConfig[d.status] || statusConfig.OFFLINE;
                        return (
                            <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800">{d.deviceName}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.deviceCode}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    <div>{d.location || '—'}</div>
                                    {(d.latitude && d.longitude) && (
                                        <div className="text-xs text-slate-400">
                                            {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                        {cfg.label}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.firmwareVersion || '—'}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    {d.username ? (
                                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                            <Users className="w-3 h-3" />
                                            {d.username}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Chưa gán</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => onEdit(d)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onDelete(d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

// ============================================
// DEVICES PAGE
// ============================================

export const DevicesPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = checkIsAdmin(user);
    const queryClient = useQueryClient();

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [lastFetch, setLastFetch] = useState<Date>(new Date());

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectMacAddress, setConnectMacAddress] = useState('');

    // Form State
    const [formData, setFormData] = useState<Partial<AdminCreateDeviceRequest & AdminUpdateDeviceRequest & { id?: number }>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Queries
    const { data: myDevices = [], isLoading: loadingMyDevices } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
        staleTime: 30000,
        refetchInterval: 60000
    });

    const { data: adminDevices = [], isLoading: loadingAdminDevices } = useQuery({
        queryKey: ['adminDevices'],
        queryFn: deviceApi.adminGetAllDevices,
        enabled: isAdmin,
        staleTime: 30000
    });

    const connectDeviceMutation = useMutation({
        mutationFn: deviceApi.connectDevice,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            setShowConnectModal(false);
            setConnectMacAddress('');
            toast.success(`Đã kết nối thiết bị "${data.deviceName}" (${data.deviceCode})`);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể kết nối thiết bị';
            toast.error(msg);
        },
    });

    // Optimistic Mutations
    const createDeviceMutation = useOptimisticMutation({
        mutationFn: deviceApi.adminCreateDevice,
        queryKey: ['adminDevices'],
        optimisticUpdate: (variables) => {
            const newDevice: AdminDeviceListItem = {
                id: Date.now(), // Temporary ID
                deviceCode: variables.deviceCode,
                deviceName: variables.deviceName || variables.deviceCode,
                location: variables.location || null,
                latitude: variables.latitude || null,
                longitude: variables.longitude || null,
                altitude: variables.altitude || null,
                status: 'OFFLINE',
                firmwareVersion: null,
                lastOnline: null,
                userId: variables.userId || null,
                username: null,
            };
            return [...adminDevices, newDevice];
        },
        successMessage: 'Tạo thiết bị thành công',
        errorMessage: 'Lỗi khi tạo thiết bị',
        onSuccess: () => {
            setShowCreateModal(false);
            setFormData({});
        },
    });

    const updateDeviceMutation = useOptimisticMutation({
        mutationFn: ({ id, data }: { id: number; data: AdminUpdateDeviceRequest }) =>
            deviceApi.adminUpdateDevice(id, data),
        queryKey: ['adminDevices', 'myDevices'],
        optimisticUpdate: ({ id, data }) => {
            return adminDevices.map((d) =>
                d.id === id ? { ...d, ...data } : d
            );
        },
        successMessage: 'Cập nhật thiết bị thành công',
        errorMessage: 'Lỗi khi cập nhật thiết bị',
        onSuccess: () => {
            setShowEditModal(false);
            setFormData({});
        },
    });

    const deleteDeviceMutation = useOptimisticMutation({
        mutationFn: deviceApi.adminDeleteDevice,
        queryKey: ['adminDevices'],
        optimisticUpdate: (deviceId) => {
            return adminDevices.filter((d) => d.id !== deviceId);
        },
        successMessage: 'Xóa thiết bị thành công',
        errorMessage: 'Lỗi khi xóa thiết bị',
    });

    // Filtering
    const filteredUserDevices = myDevices.filter((d) => {
        const matchesSearch = d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.deviceCode.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredAdminDevices = adminDevices.filter((d) => {
        const matchesSearch = d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.deviceCode.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Validation
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Validate deviceCode (required for create)
        if (showCreateModal) {
            if (!formData.deviceCode || formData.deviceCode.trim() === '') {
                errors.deviceCode = 'Mã thiết bị là bắt buộc';
            } else if (formData.deviceCode.length > 50) {
                errors.deviceCode = 'Mã thiết bị không được vượt quá 50 ký tự';
            }
        }

        // Validate deviceName
        if (!formData.deviceName || formData.deviceName.trim() === '') {
            errors.deviceName = 'Tên thiết bị là bắt buộc';
        } else if (formData.deviceName.length > 100) {
            errors.deviceName = 'Tên thiết bị không được vượt quá 100 ký tự';
        }

        // Validate location (optional but check length if provided)
        if (formData.location && formData.location.length > 255) {
            errors.location = 'Vị trí không được vượt quá 255 ký tự';
        }

        // Validate latitude
        if (formData.latitude !== undefined && formData.latitude !== null) {
            if (formData.latitude < -90 || formData.latitude > 90) {
                errors.latitude = 'Vĩ độ phải trong khoảng -90 đến 90';
            }
        }

        // Validate longitude
        if (formData.longitude !== undefined && formData.longitude !== null) {
            if (formData.longitude < -180 || formData.longitude > 180) {
                errors.longitude = 'Kinh độ phải trong khoảng -180 đến 180';
            }
        }

        // Validate altitude (optional but check if provided)
        if (formData.altitude !== undefined && formData.altitude !== null) {
            if (formData.altitude < 0) {
                errors.altitude = 'Độ cao phải lớn hơn hoặc bằng 0';
            }
        }

        // Validate userId (optional but check if provided)
        if (formData.userId !== undefined && formData.userId !== null) {
            if (formData.userId <= 0 || !Number.isInteger(formData.userId)) {
                errors.userId = 'User ID phải là số nguyên dương';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateField = (field: string, value: any): string => {
        switch (field) {
            case 'deviceCode':
                if (!value || value.trim() === '') return 'Mã thiết bị là bắt buộc';
                if (value.length > 50) return 'Mã thiết bị không được vượt quá 50 ký tự';
                return '';
            case 'deviceName':
                if (!value || value.trim() === '') return 'Tên thiết bị là bắt buộc';
                if (value.length > 100) return 'Tên thiết bị không được vượt quá 100 ký tự';
                return '';
            case 'location':
                if (value && value.length > 255) return 'Vị trí không được vượt quá 255 ký tự';
                return '';
            case 'latitude':
                if (value !== undefined && value !== null && value !== '') {
                    if (value < -90 || value > 90) return 'Vĩ độ phải trong khoảng -90 đến 90';
                }
                return '';
            case 'longitude':
                if (value !== undefined && value !== null && value !== '') {
                    if (value < -180 || value > 180) return 'Kinh độ phải trong khoảng -180 đến 180';
                }
                return '';
            case 'altitude':
                if (value !== undefined && value !== null && value !== '') {
                    if (value < 0) return 'Độ cao phải lớn hơn hoặc bằng 0';
                }
                return '';
            case 'userId':
                if (value !== undefined && value !== null && value !== '') {
                    if (value <= 0 || !Number.isInteger(value)) return 'User ID phải là số nguyên dương';
                }
                return '';
            default:
                return '';
        }
    };

    // Handlers
    const handleCreate = () => {
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        createDeviceMutation.mutate(formData as AdminCreateDeviceRequest);
    };

    const handleUpdate = () => {
        if (!formData.id) return;
        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin đã nhập');
            return;
        }
        const { id, ...payload } = formData;
        updateDeviceMutation.mutate({ id, data: payload as AdminUpdateDeviceRequest });
    };

    const handleFieldChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
        // Clear error when user starts typing
        if (formErrors[field]) {
            const error = validateField(field, value);
            if (error) {
                setFormErrors({ ...formErrors, [field]: error });
            } else {
                const newErrors = { ...formErrors };
                delete newErrors[field];
                setFormErrors(newErrors);
            }
        }
    };

    const handleFieldBlur = (field: string, value: any) => {
        const error = validateField(field, value);
        if (error) {
            setFormErrors({ ...formErrors, [field]: error });
        } else {
            const newErrors = { ...formErrors };
            delete newErrors[field];
            setFormErrors(newErrors);
        }
    };

    const openCreateModal = () => {
        setFormData({});
        setFormErrors({});
        setShowCreateModal(true);
    };

    const openEditModal = (device: AdminDeviceListItem) => {
        setFormData({
            id: device.id,
            deviceName: device.deviceName,
            location: device.location,
            latitude: device.latitude,
            longitude: device.longitude,
            altitude: device.altitude,
            userId: device.userId,
            status: device.status,
            firmwareVersion: device.firmwareVersion
        });
        setFormErrors({});
        setShowEditModal(true);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Thiết bị</h1>
                    <p className="text-slate-500 mt-1">Quản lý các thiết bị ESP32 (vườn) trong hệ thống</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowConnectModal(true); setConnectMacAddress(''); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-teal-500 text-teal-600 rounded-xl text-sm font-medium hover:bg-teal-50 transition-all"
                    >
                        <Plug className="w-4 h-4" />
                        Kết nối thiết bị
                    </button>
                    {isAdmin && (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm thiết bị
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm thiết bị..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors"
                    />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'ONLINE', 'OFFLINE'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s
                                ? 'bg-teal-500 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {s === 'ALL' ? 'Tất cả' : s === 'ONLINE' ? 'Online' : 'Offline'}
                        </button>
                    ))}
                </div>

                {/* Refresh Button */}
                <button
                    onClick={() => { queryClient.invalidateQueries({ queryKey: ['myDevices'] }); if (isAdmin) queryClient.invalidateQueries({ queryKey: ['adminDevices'] }); }}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Làm mới"
                >
                    <Loader2 className={`w-4 h-4 ${loadingMyDevices ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Tổng thiết bị</p>
                            <p className="text-xl font-bold text-slate-800">{myDevices.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <Wifi className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Đang online</p>
                            <p className="text-xl font-bold text-emerald-600">{myDevices.filter(d => d.status === 'ONLINE').length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                            <WifiOff className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Đang offline</p>
                            <p className="text-xl font-bold text-slate-500">{myDevices.filter(d => d.status === 'OFFLINE').length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Devices Grid */}
            <div>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Thiết bị của tôi</h2>
                {loadingMyDevices ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : filteredUserDevices.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                        {filteredUserDevices.map((device) => (
                            <DeviceCard key={device.id} device={device} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                        <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Không tìm thấy thiết bị nào</p>
                    </div>
                )}
            </div>

            {/* Admin Device Management */}
            {isAdmin && (
                <div>
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Quản lý thiết bị (Admin)</h2>
                    {loadingAdminDevices ? (
                        <SkeletonTable rows={5} cols={7} />
                    ) : (
                        <>
                            {(createDeviceMutation.isPending || updateDeviceMutation.isPending || deleteDeviceMutation.isPending) && (
                                <div className="mb-4">
                                    <ProgressIllusion
                                        duration={1500}
                                        label={
                                            createDeviceMutation.isPending ? 'Đang tạo thiết bị...' :
                                            updateDeviceMutation.isPending ? 'Đang cập nhật thiết bị...' :
                                            'Đang xóa thiết bị...'
                                        }
                                    />
                                </div>
                            )}
                            <AdminDeviceTable
                                devices={filteredAdminDevices}
                                onEdit={openEditModal}
                                onDelete={(id) => { if (window.confirm('Bạn có chắc muốn xóa thiết bị này?')) deleteDeviceMutation.mutate(id); }}
                            />
                        </>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {showCreateModal ? 'Thêm thiết bị mới' : 'Cập nhật thiết bị'}
                            </h3>
                            <button 
                                onClick={() => { 
                                    setShowCreateModal(false); 
                                    setShowEditModal(false); 
                                    setFormData({});
                                    setFormErrors({});
                                }} 
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {showCreateModal && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Mã thiết bị *</label>
                                    <input
                                        type="text"
                                        value={formData.deviceCode || ''}
                                        onChange={e => handleFieldChange('deviceCode', e.target.value)}
                                        onBlur={e => handleFieldBlur('deviceCode', e.target.value)}
                                        placeholder="VD: SG-ESP32-005"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.deviceCode 
                                                ? 'border-red-300 focus:border-red-400' 
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.deviceCode && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.deviceCode}</p>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên thiết bị *</label>
                                <input
                                    type="text"
                                    value={formData.deviceName || ''}
                                    onChange={e => handleFieldChange('deviceName', e.target.value)}
                                    onBlur={e => handleFieldBlur('deviceName', e.target.value)}
                                    placeholder="VD: ESP32-Garden-03"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                        formErrors.deviceName 
                                            ? 'border-red-300 focus:border-red-400' 
                                            : 'border-slate-200 focus:border-teal-400'
                                    }`}
                                />
                                {formErrors.deviceName && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.deviceName}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Vị trí (Tên)</label>
                                <input
                                    type="text"
                                    value={formData.location || ''}
                                    onChange={e => handleFieldChange('location', e.target.value)}
                                    onBlur={e => handleFieldBlur('location', e.target.value)}
                                    placeholder="VD: Hanoi"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                        formErrors.location 
                                            ? 'border-red-300 focus:border-red-400' 
                                            : 'border-slate-200 focus:border-teal-400'
                                    }`}
                                />
                                {formErrors.location && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.location}</p>
                                )}
                            </div>

                            {/* Location Coordinates */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Vĩ độ (Lat)</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={formData.latitude || ''}
                                        onChange={e => handleFieldChange('latitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        onBlur={e => handleFieldBlur('latitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        placeholder="21.0285"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.latitude 
                                                ? 'border-red-300 focus:border-red-400' 
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.latitude && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.latitude}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Kinh độ (Lon)</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={formData.longitude || ''}
                                        onChange={e => handleFieldChange('longitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        onBlur={e => handleFieldBlur('longitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        placeholder="105.8542"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.longitude 
                                                ? 'border-red-300 focus:border-red-400' 
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.longitude && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.longitude}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Độ cao (m)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.altitude || ''}
                                        onChange={e => handleFieldChange('altitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        onBlur={e => handleFieldBlur('altitude', e.target.value ? parseFloat(e.target.value) : '')}
                                        placeholder="10"
                                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                            formErrors.altitude 
                                                ? 'border-red-300 focus:border-red-400' 
                                                : 'border-slate-200 focus:border-teal-400'
                                        }`}
                                    />
                                    {formErrors.altitude && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.altitude}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Gán cho user (ID)</label>
                                <input
                                    type="number"
                                    value={formData.userId || ''}
                                    onChange={e => handleFieldChange('userId', e.target.value ? parseInt(e.target.value) : '')}
                                    onBlur={e => handleFieldBlur('userId', e.target.value ? parseInt(e.target.value) : '')}
                                    placeholder="VD: 1"
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                                        formErrors.userId 
                                            ? 'border-red-300 focus:border-red-400' 
                                            : 'border-slate-200 focus:border-teal-400'
                                    }`}
                                />
                                {formErrors.userId ? (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.userId}</p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">Để trống nếu chưa gán</p>
                                )}
                            </div>
                        </div>
                        {(createDeviceMutation.isPending || updateDeviceMutation.isPending) && (
                            <div className="mt-4">
                                <ProgressIllusion
                                    duration={2000}
                                    label={showCreateModal ? 'Đang tạo thiết bị...' : 'Đang cập nhật thiết bị...'}
                                />
                            </div>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => { 
                                    setShowCreateModal(false); 
                                    setShowEditModal(false); 
                                    setFormData({});
                                    setFormErrors({});
                                }} 
                                disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreate : handleUpdate}
                                disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending || Object.keys(formErrors).length > 0}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {(createDeviceMutation.isPending || updateDeviceMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                                {showCreateModal ? 'Tạo thiết bị' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Kết nối thiết bị bằng MAC */}
            {showConnectModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Kết nối vườn với thiết bị</h3>
                            <button
                                onClick={() => { setShowConnectModal(false); setConnectMacAddress(''); }}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Nhập địa chỉ MAC hiển thị trên màn hình ESP32 (sau khi kết nối WiFi). Ví dụ: <span className="font-mono text-slate-700">AA:BB:CC:DD:EE:FF</span>
                        </p>
                        <input
                            type="text"
                            value={connectMacAddress}
                            onChange={(e) => setConnectMacAddress(e.target.value)}
                            placeholder="AA:BB:CC:DD:EE:FF"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-400 transition-colors"
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowConnectModal(false); setConnectMacAddress(''); }}
                                disabled={connectDeviceMutation.isPending}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    const mac = connectMacAddress.trim();
                                    if (!mac) {
                                        toast.error('Vui lòng nhập địa chỉ MAC');
                                        return;
                                    }
                                    connectDeviceMutation.mutate(mac);
                                }}
                                disabled={connectDeviceMutation.isPending || !connectMacAddress.trim()}
                                className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {connectDeviceMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kết nối
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
