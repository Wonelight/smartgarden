import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Cpu, MapPin, Wifi, WifiOff, AlertTriangle, ArrowLeft,
    BarChart3, Settings2, CalendarDays, History, Brain, Pencil, X, Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { SkeletonCard } from '../components/ui/Skeleton';
import { toast } from 'sonner';

const statusConfig = {
    ONLINE: { label: 'Online', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: Wifi },
    OFFLINE: { label: 'Offline', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: WifiOff },
    ERROR: { label: 'Lỗi', color: 'bg-red-50 text-red-600', dot: 'bg-red-500', icon: AlertTriangle },
};

export const DeviceDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const deviceId = id != null ? parseInt(id, 10) : NaN;
    const [showEditModal, setShowEditModal] = useState(false);

    const { data: device, isLoading, error } = useQuery({
        queryKey: ['myDevice', deviceId],
        queryFn: () => deviceApi.getMyDeviceById(deviceId),
        enabled: Number.isInteger(deviceId) && deviceId > 0,
    });

    const updateMutation = useMutation({
        mutationFn: (payload: Parameters<typeof deviceApi.updateMyDevice>[1]) =>
            deviceApi.updateMyDevice(deviceId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myDevice', deviceId] });
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            setShowEditModal(false);
            toast.success('Đã cập nhật thiết bị');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Không thể cập nhật thiết bị');
        },
    });

    if (!Number.isInteger(deviceId) || deviceId <= 0) {
        return (
            <div className="space-y-6">
                <Link to="/devices" className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700">
                    <ArrowLeft className="w-4 h-4" /> Quay lại Thiết bị
                </Link>
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500">
                    Thiết bị không tồn tại.
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Link to="/devices" className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700">
                    <ArrowLeft className="w-4 h-4" /> Quay lại Thiết bị
                </Link>
                <SkeletonCard />
            </div>
        );
    }

    if (error || !device) {
        return (
            <div className="space-y-6">
                <Link to="/devices" className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700">
                    <ArrowLeft className="w-4 h-4" /> Quay lại Thiết bị
                </Link>
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-500">
                    Không tải được thông tin thiết bị.
                </div>
            </div>
        );
    }

    const cfg = statusConfig[device.status] || statusConfig.OFFLINE;
    const StatusIcon = cfg.icon;
    const lastOnline = device.lastOnline
        ? new Date(device.lastOnline).toLocaleString('vi-VN')
        : 'Chưa kết nối';

    const quickLinks = [
        { to: '/monitoring', state: { deviceId: device.id }, icon: BarChart3, label: 'Giám sát' },
        { to: '/irrigation-config', icon: Settings2, label: 'Cấu hình tưới' },
        { to: '/schedules', icon: CalendarDays, label: 'Lịch tưới' },
        { to: '/irrigation-history', icon: History, label: 'Lịch sử tưới' },
        { to: '/predictions', icon: Brain, label: 'Dự báo' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/devices')}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Quay lại"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Chi tiết thiết bị</h1>
                        <p className="text-slate-500 text-sm">Thông tin và truy cập nhanh</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                    <Pencil className="w-4 h-4" /> Chỉnh sửa
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600">
                                <Cpu className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-slate-800">{device.deviceName}</h2>
                                <p className="text-sm font-mono text-slate-500 mt-0.5">{device.deviceCode}</p>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mt-2 ${cfg.color}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {cfg.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400 text-xs block mb-1">Vị trí</span>
                            <p className="text-slate-700 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {device.location || '—'}
                            </p>
                            {(device.latitude != null && device.longitude != null) && (
                                <p className="text-slate-500 text-xs mt-1 pl-6">
                                    {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                                    {device.altitude != null && ` · ${device.altitude}m`}
                                </p>
                            )}
                        </div>
                        <div>
                            <span className="text-slate-400 text-xs block mb-1">Kết nối lần cuối</span>
                            <p className="text-slate-700">{lastOnline}</p>
                        </div>
                        {device.firmwareVersion && (
                            <div>
                                <span className="text-slate-400 text-xs block mb-1">Firmware</span>
                                <p className="font-mono text-slate-700">{device.firmwareVersion}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <h3 className="text-sm font-semibold text-slate-600 mb-3">Truy cập nhanh</h3>
                        <div className="flex flex-wrap gap-2">
                            {quickLinks.map(({ to, state, icon: Icon, label }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    state={state}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-700 text-sm font-medium hover:bg-teal-50 hover:text-teal-700 transition-colors"
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showEditModal && device && (
                <EditDeviceModalInline
                    device={device}
                    onClose={() => setShowEditModal(false)}
                    onSave={(payload) => updateMutation.mutate(payload)}
                    isPending={updateMutation.isPending}
                />
            )}
        </div>
    );
};

const EditDeviceModalInline: React.FC<{
    device: { id: number; deviceName: string; deviceCode: string; location: string | null; latitude?: number | null; longitude?: number | null; altitude?: number | null };
    onClose: () => void;
    onSave: (payload: { deviceName?: string; location?: string | null; latitude?: number | null; longitude?: number | null; altitude?: number | null }) => void;
    isPending: boolean;
}> = ({ device, onClose, onSave, isPending }) => {
    const [deviceName, setDeviceName] = useState(device.deviceName);
    const [location, setLocation] = useState(device.location ?? '');
    const [latitude, setLatitude] = useState(device.latitude != null ? String(device.latitude) : '');
    const [longitude, setLongitude] = useState(device.longitude != null ? String(device.longitude) : '');
    const [altitude, setAltitude] = useState(device.altitude != null ? String(device.altitude) : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            deviceName: deviceName.trim() || undefined,
            location: location.trim() || null,
            latitude: latitude.trim() ? parseFloat(latitude) : null,
            longitude: longitude.trim() ? parseFloat(longitude) : null,
            altitude: altitude.trim() ? parseFloat(altitude) : null,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Chỉnh sửa thiết bị</h3>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-xs text-slate-500 mb-3 font-mono">Mã thiết bị: {device.deviceCode}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên thiết bị</label>
                        <input type="text" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" placeholder="Ví dụ: Vườn nhà" maxLength={100} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí / Địa chỉ</label>
                        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" placeholder="Ví dụ: Hà Nội" maxLength={255} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vĩ độ</label>
                            <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" placeholder="21.0285" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Kinh độ</label>
                            <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" placeholder="105.8542" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Độ cao (m)</label>
                        <input type="text" value={altitude} onChange={(e) => setAltitude(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" placeholder="Tùy chọn" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isPending} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
                        <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
