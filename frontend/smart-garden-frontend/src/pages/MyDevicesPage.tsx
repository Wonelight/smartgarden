import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Wifi, WifiOff, AlertTriangle, Search, MapPin, Cpu,
    Plug, BarChart3, Settings2, CalendarDays, Package, Loader2, X, Pencil, Unplug, Trash2, MoreVertical, FileText, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import type { UserDeviceListItem } from '../api/device';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Dropdown } from '../components/Dropdown';

const statusConfig = {
    ONLINE: { label: 'Online', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: Wifi },
    OFFLINE: { label: 'Offline', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: WifiOff },
    ERROR: { label: 'Lỗi', color: 'bg-red-50 text-red-600', dot: 'bg-red-500', icon: AlertTriangle },
};

type EditDevicePayload = {
    deviceName?: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
};

const EditDeviceModal: React.FC<{
    device: UserDeviceListItem;
    onClose: () => void;
    onSave: (payload: EditDevicePayload) => void;
    isPending: boolean;
}> = ({ device, onClose, onSave, isPending }) => {
    const [deviceName, setDeviceName] = useState(device.deviceName);
    const [location, setLocation] = useState(device.location ?? '');
    const [latitude, setLatitude] = useState(device.latitude != null ? String(device.latitude) : '');
    const [longitude, setLongitude] = useState(device.longitude != null ? String(device.longitude) : '');
    const [altitude, setAltitude] = useState(device.altitude != null ? String(device.altitude) : '');
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
                setLatitude(lat.toFixed(6));
                setLongitude(lng.toFixed(6));

                try {
                    // Lấy độ cao (Altitude) bằng API Open-Meteo
                    const altRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
                    if (altRes.ok) {
                        const altData = await altRes.json();
                        if (altData?.elevation?.[0] != null) {
                            setAltitude(altData.elevation[0].toFixed(1));
                        }
                    }

                    // Lấy tên khu vực (Reverse Geocoding) bằng BigDataCloud API
                    const locRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`);
                    if (locRes.ok) {
                        const locData = await locRes.json();
                        const addressParts = [locData.locality || locData.city, locData.principalSubdivision, locData.countryName].filter(Boolean);
                        const address = addressParts.join(', ');
                        if (address) {
                            setLocation(address.length > 255 ? address.substring(0, 255) : address);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: EditDevicePayload = {
            deviceName: deviceName.trim() || undefined,
            location: location.trim() || null,
            latitude: latitude.trim() ? parseFloat(latitude) : null,
            longitude: longitude.trim() ? parseFloat(longitude) : null,
            altitude: altitude.trim() ? parseFloat(altitude) : null,
        };
        onSave(payload);
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
                        <input
                            type="text"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                            placeholder="Ví dụ: Vườn nhà"
                            maxLength={100}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí / Địa chỉ</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                            placeholder="Ví dụ: Hà Nội"
                            maxLength={255}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vĩ độ</label>
                            <input
                                type="text"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                                placeholder="21.0285"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Kinh độ</label>
                            <input
                                type="text"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                                placeholder="105.8542"
                            />
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Độ cao (m)</label>
                        <input
                            type="text"
                            value={altitude}
                            onChange={(e) => setAltitude(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                            placeholder="Tùy chọn"
                        />
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

const DeviceCard: React.FC<{
    device: UserDeviceListItem;
    onEdit?: (device: UserDeviceListItem) => void;
    onDisconnect?: (device: UserDeviceListItem) => void;
    onDelete?: (device: UserDeviceListItem) => void;
}> = ({ device, onEdit, onDisconnect, onDelete }) => {
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
                            {onEdit && (
                                <Dropdown.Item icon={<Pencil className="w-4 h-4" />} onClick={() => onEdit(device)}>Chỉnh sửa</Dropdown.Item>
                            )}
                            {onDisconnect && (
                                <Dropdown.Item icon={<Unplug className="w-4 h-4" />} onClick={() => onDisconnect(device)}>Ngắt kết nối</Dropdown.Item>
                            )}
                            {onDelete && (
                                <Dropdown.Item icon={<Trash2 className="w-4 h-4" />} onClick={() => onDelete(device)} variant="danger">Xóa thiết bị</Dropdown.Item>
                            )}
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
                    <p className="text-xs text-slate-400 pl-6">Kết nối lần cuối: {formattedDate}</p>
                </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 rounded-b-2xl space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-400 text-xs">Mã thiết bị</span><p className="font-mono text-slate-700">{device.deviceCode}</p></div>
                    <div><span className="text-slate-400 text-xs">Trạng thái</span><div className="flex items-center gap-1.5 mt-0.5"><span className={`w-2 h-2 rounded-full ${cfg.dot}`} /><span className="text-slate-700">{cfg.label}</span></div></div>
                    <div><span className="text-slate-400 text-xs">Vị trí</span><p className="text-slate-700">{device.location || '—'}</p></div>
                    <div><span className="text-slate-400 text-xs">Kết nối cuối</span><p className="text-slate-700">{formattedDate}</p></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                    <Link to={`/devices/${device.id}`} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 min-h-[2.25rem]">Chi tiết thiết bị</Link>
                    <Link to="/monitoring" state={{ deviceId: device.id }} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"><BarChart3 className="w-3.5 h-3.5 shrink-0" /> Giám sát</Link>
                    <Link to="/irrigation-config" className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"><Settings2 className="w-3.5 h-3.5 shrink-0" /> Cấu hình tưới</Link>
                    <Link to="/schedules" className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 min-h-[2.25rem]"><CalendarDays className="w-3.5 h-3.5 shrink-0" /> Lịch tưới</Link>
                </div>
            </div>
        </div>
    );
};

export const MyDevicesPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectMacAddress, setConnectMacAddress] = useState('');
    const [deviceToEdit, setDeviceToEdit] = useState<UserDeviceListItem | null>(null);

    const { data: myDevices = [], isLoading } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
        staleTime: 30000,
        refetchInterval: 60000,
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
            toast.error(err?.response?.data?.message || err?.message || 'Không thể kết nối thiết bị');
        },
    });

    const updateDeviceMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof deviceApi.updateMyDevice>[1] }) =>
            deviceApi.updateMyDevice(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            setDeviceToEdit(null);
            toast.success('Đã cập nhật thiết bị');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Không thể cập nhật thiết bị');
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: deviceApi.disconnectMyDevice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            toast.success('Đã ngắt kết nối thiết bị');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Không thể ngắt kết nối');
        },
    });

    const handleDisconnect = (device: UserDeviceListItem) => {
        if (!window.confirm(`Ngắt kết nối thiết bị "${device.deviceName}"? Thiết bị vẫn tồn tại trong hệ thống, bạn có thể kết nối lại sau.`)) return;
        disconnectMutation.mutate(device.id);
    };

    const deleteMutation = useMutation({
        mutationFn: deviceApi.deleteMyDevice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            toast.success('Đã xóa thiết bị');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Không thể xóa thiết bị');
        },
    });

    const handleDelete = (device: UserDeviceListItem) => {
        if (!window.confirm(`Xóa thiết bị "${device.deviceName}"? Hành động này không thể hoàn tác.`)) return;
        deleteMutation.mutate(device.id);
    };

    const filtered = myDevices.filter((d) => {
        const matchSearch = d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) || d.deviceCode.toLowerCase().includes(searchQuery.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Thiết bị của tôi</h1>
                    <p className="text-slate-500 mt-1">Kết nối thiết bị ESP32 (vườn) và xem danh sách vườn của bạn</p>
                </div>
                <button
                    onClick={() => { setShowConnectModal(true); setConnectMacAddress(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-all shadow-sm"
                >
                    <Plug className="w-4 h-4" />
                    Kết nối thiết bị
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm thiết bị..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                    />
                </div>
                <div className="flex gap-2">
                    {['ALL', 'ONLINE', 'OFFLINE'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? 'bg-teal-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {s === 'ALL' ? 'Tất cả' : s === 'ONLINE' ? 'Online' : 'Offline'}
                        </button>
                    ))}
                </div>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ['myDevices'] })} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Làm mới">
                    <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600"><Package className="w-5 h-5" /></div>
                        <div><p className="text-xs text-slate-400">Tổng thiết bị</p><p className="text-xl font-bold text-slate-800">{myDevices.length}</p></div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Wifi className="w-5 h-5" /></div>
                        <div><p className="text-xs text-slate-400">Đang online</p><p className="text-xl font-bold text-emerald-600">{myDevices.filter(d => d.status === 'ONLINE').length}</p></div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500"><WifiOff className="w-5 h-5" /></div>
                        <div><p className="text-xs text-slate-400">Đang offline</p><p className="text-xl font-bold text-slate-500">{myDevices.filter(d => d.status === 'OFFLINE').length}</p></div>
                    </div>
                </div>
            </div>

            <div>
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                        {filtered.map((device) => (
                            <DeviceCard key={device.id} device={device} onEdit={setDeviceToEdit} onDisconnect={handleDisconnect} onDelete={handleDelete} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                        <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 mb-2">Chưa có thiết bị nào. Nhấn &quot;Kết nối thiết bị&quot; và nhập địa chỉ MAC từ ESP32 để thêm vườn.</p>
                    </div>
                )}
            </div>

            {showConnectModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Kết nối vườn với thiết bị</h3>
                            <button onClick={() => { setShowConnectModal(false); setConnectMacAddress(''); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Nhập địa chỉ MAC hiển thị trên màn hình ESP32 (sau khi kết nối WiFi). Ví dụ: <span className="font-mono text-slate-700">AA:BB:CC:DD:EE:FF</span>
                        </p>
                        <input
                            type="text"
                            value={connectMacAddress}
                            onChange={(e) => setConnectMacAddress(e.target.value)}
                            placeholder="AA:BB:CC:DD:EE:FF"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-400"
                        />
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowConnectModal(false); setConnectMacAddress(''); }} disabled={connectDeviceMutation.isPending} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
                            <button
                                onClick={() => {
                                    const mac = connectMacAddress.trim();
                                    if (!mac) { toast.error('Vui lòng nhập địa chỉ MAC'); return; }
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

            {deviceToEdit && (
                <EditDeviceModal
                    device={deviceToEdit}
                    onClose={() => setDeviceToEdit(null)}
                    onSave={(payload) => updateDeviceMutation.mutate({ id: deviceToEdit.id, payload })}
                    isPending={updateDeviceMutation.isPending}
                />
            )}
        </div>
    );
};
