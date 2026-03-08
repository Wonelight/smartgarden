import React, { useState } from 'react';
import {
    Wifi, WifiOff, AlertTriangle, Search, Plus, Pencil, Trash2,
    X, Users, Loader2, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import type { AdminDeviceListItem, AdminCreateDeviceRequest, AdminUpdateDeviceRequest } from '../api/device';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { ProgressIllusion } from '../components/ui/ProgressBar';
import { SkeletonTable } from '../components/ui/Skeleton';

const statusConfig = {
    ONLINE: { label: 'Online', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: Wifi },
    OFFLINE: { label: 'Offline', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: WifiOff },
    ERROR: { label: 'Lỗi', color: 'bg-red-50 text-red-600', dot: 'bg-red-500', icon: AlertTriangle },
};

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
                                        <div className="text-xs text-slate-400">{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</div>
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
                                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" />{d.username}</span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Chưa gán</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => onEdit(d)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
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

export const AdminDevicesPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [formData, setFormData] = useState<Partial<AdminCreateDeviceRequest & AdminUpdateDeviceRequest & { id?: number }>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isDetecting, setIsDetecting] = useState(false);

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Trình duyệt không hỗ trợ định vị');
            return;
        }

        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                handleFieldChange('latitude', parseFloat(lat.toFixed(6)));
                handleFieldChange('longitude', parseFloat(lng.toFixed(6)));

                try {
                    // Lấy độ cao (Altitude) bằng API Open-Meteo
                    const altRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
                    if (altRes.ok) {
                        const altData = await altRes.json();
                        if (altData?.elevation?.[0] != null) {
                            handleFieldChange('altitude', parseFloat(altData.elevation[0].toFixed(1)));
                        }
                    }

                    // Lấy tên khu vực (Reverse Geocoding) bằng BigDataCloud API
                    const locRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`);
                    if (locRes.ok) {
                        const locData = await locRes.json();
                        const addressParts = [locData.locality || locData.city, locData.principalSubdivision, locData.countryName].filter(Boolean);
                        const address = addressParts.join(', ');
                        if (address) {
                            handleFieldChange('location', address.length > 255 ? address.substring(0, 255) : address);
                        }
                    }
                } catch (err) {
                    console.error("Lỗi khi lấy thông tin phụ trợ:", err);
                }

                setIsDetecting(false);
                toast.success('Đã lấy tọa độ và các thông tin liên quan');
            },
            (error) => {
                let errorMsg = 'Không thể lấy tọa độ';
                if (error.code === error.PERMISSION_DENIED) errorMsg = 'Vui lòng cấp quyền truy cập vị trí';
                toast.error(errorMsg);
                setIsDetecting(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const { data: adminDevices = [], isLoading } = useQuery({
        queryKey: ['adminDevices'],
        queryFn: deviceApi.adminGetAllDevices,
        staleTime: 30000,
    });

    const createDeviceMutation = useOptimisticMutation({
        mutationFn: deviceApi.adminCreateDevice,
        queryKey: ['adminDevices'],
        optimisticUpdate: (variables) => {
            const newDevice: AdminDeviceListItem = {
                id: Date.now(),
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
        onSuccess: () => { setShowCreateModal(false); setFormData({}); },
    });

    const updateDeviceMutation = useOptimisticMutation({
        mutationFn: ({ id, data }: { id: number; data: AdminUpdateDeviceRequest }) => deviceApi.adminUpdateDevice(id, data),
        queryKey: ['adminDevices', 'myDevices'],
        optimisticUpdate: ({ id, data }) => adminDevices.map((d) => (d.id === id ? { ...d, ...data } : d)),
        successMessage: 'Cập nhật thiết bị thành công',
        errorMessage: 'Lỗi khi cập nhật thiết bị',
        onSuccess: () => { setShowEditModal(false); setFormData({}); },
    });

    const deleteDeviceMutation = useOptimisticMutation({
        mutationFn: deviceApi.adminDeleteDevice,
        queryKey: ['adminDevices'],
        optimisticUpdate: (deviceId) => adminDevices.filter((d) => d.id !== deviceId),
        successMessage: 'Xóa thiết bị thành công',
        errorMessage: 'Lỗi khi xóa thiết bị',
    });

    const filtered = adminDevices.filter((d) => {
        const matchSearch = d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) || d.deviceCode.toLowerCase().includes(searchQuery.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (showCreateModal) {
            if (!formData.deviceCode?.trim()) errors.deviceCode = 'Mã thiết bị là bắt buộc';
            else if ((formData.deviceCode?.length ?? 0) > 50) errors.deviceCode = 'Mã thiết bị không được vượt quá 50 ký tự';
        }
        if (!formData.deviceName?.trim()) errors.deviceName = 'Tên thiết bị là bắt buộc';
        else if ((formData.deviceName?.length ?? 0) > 100) errors.deviceName = 'Tên thiết bị không được vượt quá 100 ký tự';
        if (formData.location && formData.location.length > 255) errors.location = 'Vị trí không được vượt quá 255 ký tự';
        if (formData.latitude != null && (formData.latitude < -90 || formData.latitude > 90)) errors.latitude = 'Vĩ độ phải trong khoảng -90 đến 90';
        if (formData.longitude != null && (formData.longitude < -180 || formData.longitude > 180)) errors.longitude = 'Kinh độ phải trong khoảng -180 đến 180';
        if (formData.altitude != null && formData.altitude < 0) errors.altitude = 'Độ cao phải lớn hơn hoặc bằng 0';
        if (formData.userId != null && (Number(formData.userId) <= 0 || !Number.isInteger(Number(formData.userId)))) errors.userId = 'User ID phải là số nguyên dương';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateField = (field: string, value: unknown): string => {
        switch (field) {
            case 'deviceCode': return !value || (typeof value === 'string' && !value.trim()) ? 'Mã thiết bị là bắt buộc' : (typeof value === 'string' && value.length > 50 ? 'Mã thiết bị không được vượt quá 50 ký tự' : '');
            case 'deviceName': return !value || (typeof value === 'string' && !value.trim()) ? 'Tên thiết bị là bắt buộc' : (typeof value === 'string' && value.length > 100 ? 'Tên thiết bị không được vượt quá 100 ký tự' : '');
            case 'location': return value && typeof value === 'string' && value.length > 255 ? 'Vị trí không được vượt quá 255 ký tự' : '';
            case 'latitude': return value != null && value !== '' && (Number(value) < -90 || Number(value) > 90) ? 'Vĩ độ phải trong khoảng -90 đến 90' : '';
            case 'longitude': return value != null && value !== '' && (Number(value) < -180 || Number(value) > 180) ? 'Kinh độ phải trong khoảng -180 đến 180' : '';
            case 'altitude': return value != null && value !== '' && Number(value) < 0 ? 'Độ cao phải lớn hơn hoặc bằng 0' : '';
            case 'userId': return value != null && value !== '' && (Number(value) <= 0 || !Number.isInteger(Number(value))) ? 'User ID phải là số nguyên dương' : '';
            default: return '';
        }
    };

    const handleFieldChange = (field: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (formErrors[field]) {
            const err = validateField(field, value);
            setFormErrors((prev) => (err ? { ...prev, [field]: err } : (() => { const n = { ...prev }; delete n[field]; return n; })()));
        }
    };
    const handleFieldBlur = (field: string, value: unknown) => {
        const err = validateField(field, value);
        setFormErrors((prev) => (err ? { ...prev, [field]: err } : (() => { const n = { ...prev }; delete n[field]; return n; })()));
    };

    const handleCreate = () => {
        if (!validateForm()) { toast.error('Vui lòng kiểm tra lại thông tin đã nhập'); return; }
        createDeviceMutation.mutate(formData as AdminCreateDeviceRequest);
    };
    const handleUpdate = () => {
        if (!formData.id) return;
        if (!validateForm()) { toast.error('Vui lòng kiểm tra lại thông tin đã nhập'); return; }
        const { id, ...payload } = formData;
        updateDeviceMutation.mutate({ id: id!, data: payload as AdminUpdateDeviceRequest });
    };

    const openCreateModal = () => { setFormData({}); setFormErrors({}); setShowCreateModal(true); };
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
            firmwareVersion: device.firmwareVersion,
        });
        setFormErrors({});
        setShowEditModal(true);
    };

    const inputCls = (field: string) => `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${formErrors[field] ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-teal-400'}`;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Quản lý thiết bị</h1>
                    <p className="text-slate-500 mt-1">Tạo, sửa, xóa thiết bị và gán cho người dùng</p>
                </div>
                <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> Thêm thiết bị
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Tìm thiết bị..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'ONLINE', 'OFFLINE'].map((s) => (
                        <button key={s} onClick={() => setStatusFilter(s)} className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? 'bg-teal-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            {s === 'ALL' ? 'Tất cả' : s === 'ONLINE' ? 'Online' : 'Offline'}
                        </button>
                    ))}
                </div>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ['adminDevices'] })} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Làm mới">
                    <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {(createDeviceMutation.isPending || updateDeviceMutation.isPending || deleteDeviceMutation.isPending) && (
                <ProgressIllusion duration={1500} label={createDeviceMutation.isPending ? 'Đang tạo thiết bị...' : updateDeviceMutation.isPending ? 'Đang cập nhật thiết bị...' : 'Đang xóa thiết bị...'} />
            )}

            {isLoading ? (
                <SkeletonTable rows={5} cols={7} />
            ) : (
                <AdminDeviceTable
                    devices={filtered}
                    onEdit={openEditModal}
                    onDelete={(id) => window.confirm('Bạn có chắc muốn xóa thiết bị này?') && deleteDeviceMutation.mutate(id)}
                />
            )}

            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-slate-800">{showCreateModal ? 'Thêm thiết bị mới' : 'Cập nhật thiết bị'}</h3>
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); setFormData({}); setFormErrors({}); }} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            {showCreateModal && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Mã thiết bị *</label>
                                    <input type="text" value={formData.deviceCode || ''} onChange={(e) => handleFieldChange('deviceCode', e.target.value)} onBlur={(e) => handleFieldBlur('deviceCode', e.target.value)} placeholder="VD: SG-ESP32-005" className={inputCls('deviceCode')} />
                                    {formErrors.deviceCode && <p className="mt-1 text-xs text-red-600">{formErrors.deviceCode}</p>}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên thiết bị *</label>
                                <input type="text" value={formData.deviceName || ''} onChange={(e) => handleFieldChange('deviceName', e.target.value)} onBlur={(e) => handleFieldBlur('deviceName', e.target.value)} placeholder="VD: ESP32-Garden-03" className={inputCls('deviceName')} />
                                {formErrors.deviceName && <p className="mt-1 text-xs text-red-600">{formErrors.deviceName}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Vị trí (Tên)</label>
                                <input type="text" value={formData.location || ''} onChange={(e) => handleFieldChange('location', e.target.value)} placeholder="VD: Hanoi" className={inputCls('location')} />
                                {formErrors.location && <p className="mt-1 text-xs text-red-600">{formErrors.location}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Vĩ độ (Lat)</label>
                                    <input type="number" step="0.000001" value={formData.latitude ?? ''} onChange={(e) => handleFieldChange('latitude', e.target.value ? parseFloat(e.target.value) : '')} onBlur={(e) => handleFieldBlur('latitude', e.target.value ? parseFloat(e.target.value) : '')} placeholder="21.0285" className={inputCls('latitude')} />
                                    {formErrors.latitude && <p className="mt-1 text-xs text-red-600">{formErrors.latitude}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Kinh độ (Lon)</label>
                                    <input type="number" step="0.000001" value={formData.longitude ?? ''} onChange={(e) => handleFieldChange('longitude', e.target.value ? parseFloat(e.target.value) : '')} onBlur={(e) => handleFieldBlur('longitude', e.target.value ? parseFloat(e.target.value) : '')} placeholder="105.8542" className={inputCls('longitude')} />
                                    {formErrors.longitude && <p className="mt-1 text-xs text-red-600">{formErrors.longitude}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Độ cao (m)</label>
                                    <input type="number" step="0.1" value={formData.altitude ?? ''} onChange={(e) => handleFieldChange('altitude', e.target.value ? parseFloat(e.target.value) : '')} placeholder="10" className={inputCls('altitude')} />
                                    {formErrors.altitude && <p className="mt-1 text-xs text-red-600">{formErrors.altitude}</p>}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={isDetecting}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                                {isDetecting ? 'Đang lấy tọa độ...' : 'Lấy tọa độ hiện tại'}
                            </button>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Gán cho user (ID)</label>
                                <input type="number" value={formData.userId ?? ''} onChange={(e) => handleFieldChange('userId', e.target.value ? parseInt(e.target.value, 10) : '')} onBlur={(e) => handleFieldBlur('userId', e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="VD: 1" className={inputCls('userId')} />
                                {formErrors.userId ? <p className="mt-1 text-xs text-red-600">{formErrors.userId}</p> : <p className="text-xs text-slate-400 mt-1">Để trống nếu chưa gán</p>}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); setFormData({}); setFormErrors({}); }} disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
                            <button onClick={showCreateModal ? handleCreate : handleUpdate} disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending || Object.keys(formErrors).length > 0} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                {(createDeviceMutation.isPending || updateDeviceMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                                {showCreateModal ? 'Tạo thiết bị' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
