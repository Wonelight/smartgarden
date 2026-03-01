import React, { useState } from 'react';
import {
    ScrollText,
    RefreshCw,
    Loader2,
    AlertCircle,
    AlertTriangle,
    Info,
    Filter,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import type { SystemLog, LogLevel } from '../types/dashboard';

const TEAL = '#2DD4BF';

const MOCK_LOGS: SystemLog[] = [
    {
        id: 1,
        logLevel: 'INFO',
        source: 'DeviceService',
        message: 'ESP32-Garden-01 đã kết nối thành công',
        timestamp: '2026-02-15T09:40:00+07:00',
    },
    {
        id: 2,
        logLevel: 'INFO',
        source: 'IrrigationService',
        message: 'Hoàn thành tưới tự động - 2.1L nước đã sử dụng',
        timestamp: '2026-02-15T09:35:00+07:00',
    },
    {
        id: 3,
        logLevel: 'WARNING',
        source: 'SensorService',
        message: 'Độ ẩm đất thấp hơn ngưỡng tối thiểu (28%)',
        timestamp: '2026-02-15T09:30:00+07:00',
    },
    {
        id: 4,
        logLevel: 'INFO',
        source: 'MLService',
        message: 'Cập nhật dự báo mới với độ tin cậy 87%',
        timestamp: '2026-02-15T09:00:00+07:00',
    },
    {
        id: 5,
        logLevel: 'ERROR',
        source: 'MQTTService',
        message: 'Mất kết nối MQTT broker, đang thử kết nối lại...',
        timestamp: '2026-02-15T08:45:00+07:00',
    },
    {
        id: 6,
        logLevel: 'INFO',
        source: 'DeviceService',
        message: 'ESP32-Garden-01 đã kết nối thành công',
        timestamp: '2026-02-15T08:30:00+07:00',
    },
    {
        id: 7,
        logLevel: 'WARNING',
        source: 'IrrigationService',
        message: 'Lịch tưới bị bỏ qua - thiết bị đang offline',
        timestamp: '2026-02-15T08:00:00+07:00',
    },
    {
        id: 8,
        logLevel: 'INFO',
        source: 'ANFISService',
        message: 'Dự đoán ANFIS cho device 1: lượng tưới 2.3L',
        timestamp: '2026-02-15T07:30:00+07:00',
    },
];

const getLevelConfig = (level: LogLevel) => {
    switch (level) {
        case 'ERROR':
            return {
                icon: AlertCircle,
                bgColor: 'bg-red-50',
                textColor: 'text-red-600',
                badgeBg: 'bg-red-100',
            };
        case 'WARNING':
            return {
                icon: AlertTriangle,
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-600',
                badgeBg: 'bg-amber-100',
            };
        case 'INFO':
        default:
            return {
                icon: Info,
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-600',
                badgeBg: 'bg-blue-100',
            };
    }
};

const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const LOG_LEVELS: LogLevel[] = ['INFO', 'WARNING', 'ERROR'];

export const SystemLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<SystemLog[]>(MOCK_LOGS);
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
    const [sourceFilter, setSourceFilter] = useState<string>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const sources = Array.from(new Set(logs.map((l) => l.source))).sort();

    const filteredLogs = logs.filter((log) => {
        if (levelFilter !== 'ALL' && log.logLevel !== levelFilter) return false;
        if (sourceFilter !== 'ALL' && log.source !== sourceFilter) return false;
        return true;
    });

    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // TODO: Gọi API lấy logs thực tế
            await new Promise((r) => setTimeout(r, 1000));
            setLogs(MOCK_LOGS);
            setPage(1);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                        Nhật ký hệ thống
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Xem log hoạt động và sự kiện của Smart Garden
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                    {isRefreshing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    Làm mới
                </button>
            </div>

            {/* Bộ lọc */}
            <div className="flex flex-wrap items-center gap-3">
                <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium">Cấp độ:</span>
                    {['ALL', ...LOG_LEVELS].map((level) => (
                        <button
                            key={level}
                            onClick={() => {
                                setLevelFilter(level as LogLevel | 'ALL');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                                levelFilter === level
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            style={levelFilter === level ? { backgroundColor: TEAL } : undefined}
                        >
                            {level}
                        </button>
                    ))}
                </div>
                <select
                    value={sourceFilter}
                    onChange={(e) => {
                        setSourceFilter(e.target.value);
                        setPage(1);
                    }}
                    className="rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                    <option value="ALL">Tất cả nguồn</option>
                    {sources.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </div>

            {/* Bảng log */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">
                                    Cấp độ
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">
                                    Nguồn
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Nội dung
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-48">
                                    Thời gian
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLogs.map((log) => {
                                const config = getLevelConfig(log.logLevel);
                                const Icon = config.icon;
                                return (
                                    <tr
                                        key={log.id}
                                        className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 ${config.bgColor}`}
                                    >
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold ${config.badgeBg} ${config.textColor}`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {log.logLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                            {log.source}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {log.message}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center">
                        <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Không có log nào</p>
                    </div>
                ) : (
                    totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                            <p className="text-sm text-slate-500">
                                Trang {page} / {totalPages} • {filteredLogs.length} bản ghi
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
