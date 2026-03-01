import React, { useState, useEffect } from 'react';
import {
    Droplets, ChevronLeft, ChevronRight,
    BarChart3, Timer, TrendingUp
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { irrigationApi } from '../api/irrigation';

const ITEMS_PER_PAGE = 8;

const triggerConfig: Record<string, { label: string; color: string; dot: string }> = {
    MANUAL: { label: 'Thủ công', color: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
    AUTO: { label: 'Tự động', color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
    SCHEDULE: { label: 'Lịch hẹn', color: 'bg-purple-50 text-purple-600', dot: 'bg-purple-500' },
    ML: { label: 'ML/AI', color: 'bg-orange-50 text-orange-600', dot: 'bg-orange-500' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
    COMPLETED: { label: 'Hoàn thành', color: 'text-emerald-600 bg-emerald-50' },
    IN_PROGRESS: { label: 'Đang tưới', color: 'text-blue-600 bg-blue-50' },
    FAILED: { label: 'Lỗi', color: 'text-red-600 bg-red-50' },
};

export const IrrigationHistoryPage: React.FC = () => {
    const [deviceId, setDeviceId] = useState<number | null>(null);
    const [page, setPage] = useState(1);

    const { data: devices = [] } = useQuery({ queryKey: ['myDevices'], queryFn: deviceApi.getMyDevices });
    const { data: historyPage } = useQuery({
        queryKey: ['irrigationHistory', deviceId, page],
        queryFn: () => irrigationApi.getHistoryByDeviceId(deviceId!, page - 1, ITEMS_PER_PAGE),
        enabled: !!deviceId,
    });

    useEffect(() => {
        if (devices.length > 0 && deviceId === null) setDeviceId(devices[0].id);
    }, [devices, deviceId]);

    const content = historyPage?.content ?? [];
    const totalPages = historyPage?.totalPages ?? 1;
    const totalElements = historyPage?.totalElements ?? 0;

    const completedItems = content.filter((d) => d.status === 'COMPLETED');
    const totalWater = completedItems.reduce((s, d) => s + (d.waterVolume ?? 0), 0);
    const totalDuration = completedItems.reduce((s, d) => s + (d.duration ?? 0), 0);
    const avgWater = completedItems.length > 0 ? totalWater / completedItems.length : 0;

    const formatTime = (iso: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    const formatDuration = (seconds: number) => {
        if (seconds === 0) return '—';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}p ${s}s` : `${s}s`;
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Lịch sử tưới</h1>
                <p className="text-slate-500 mt-1">Theo dõi lịch sử các lần tưới và thống kê sử dụng nước</p>
            </div>

            {devices.length > 0 && (
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700">Thiết bị:</label>
                    <select
                        value={deviceId ?? ''}
                        onChange={(e) => { setDeviceId(Number(e.target.value)); setPage(1); }}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {devices.map((d) => (
                            <option key={d.id} value={d.id}>{d.deviceName}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">Tổng lần tưới</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{totalElements}</span>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                            <Droplets className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">Tổng nước dùng</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{totalWater.toFixed(1)}</span>
                        <span className="text-sm text-slate-400">lít</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                            <Timer className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">Tổng thời gian</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{Math.floor(totalDuration / 60)}</span>
                        <span className="text-sm text-slate-400">phút</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">TB/lần tưới</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{avgWater.toFixed(1)}</span>
                        <span className="text-sm text-slate-400">lít</span>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Thời gian bắt đầu</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Kết thúc</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Thời lượng</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Lượng nước</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Kích hoạt bởi</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {content.map((item) => {
                                const mode = (item.irrigationMode || 'MANUAL').toUpperCase();
                                const trigger = triggerConfig[mode] ?? triggerConfig.MANUAL;
                                const status = statusConfig[item.status] ?? statusConfig.COMPLETED;
                                const duration = item.duration ?? 0;
                                const waterVolume = item.waterVolume ?? 0;
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatTime(item.startTime)}</td>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatTime(item.endTime ?? '')}</td>
                                        <td className="px-4 py-3 text-slate-700 font-medium">{formatDuration(duration)}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-slate-700">{waterVolume > 0 ? `${waterVolume} L` : '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${trigger.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${trigger.dot}`} />
                                                {trigger.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                        <span className="text-sm text-slate-500">
                            Trang {page}/{totalPages} ({totalElements} kết quả)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === page
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
