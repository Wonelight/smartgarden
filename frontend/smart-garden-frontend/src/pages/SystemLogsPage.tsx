import React, { useState, useEffect, useCallback } from 'react';
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
import { logsApi } from '../api/logs';
import type { SystemLogItem } from '../api/logs';
import type { LogLevel, LogSource } from '../types/dashboard';
import { toast } from 'sonner';

const TEAL = '#2DD4BF';

const getLevelConfig = (level: LogLevel) => {
    switch (level) {
        case 'ERROR':
        case 'CRITICAL':
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

const LOG_LEVELS: LogLevel[] = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const LOG_SOURCES: LogSource[] = ['ESP32', 'BACKEND', 'ML_SERVICE', 'AI_SERVICE', 'FRONTEND'];
const PAGE_SIZE = 20;

export const SystemLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<SystemLogItem[]>([]);
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
    const [sourceFilter, setSourceFilter] = useState<LogSource | 'ALL'>('ALL');
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    const fetchLogs = useCallback(async (
        currentPage: number,
        level: LogLevel | 'ALL',
        source: LogSource | 'ALL'
    ) => {
        setIsLoading(true);
        try {
            const result = await logsApi.getMyLogs({
                page: currentPage,
                size: PAGE_SIZE,
                level: level !== 'ALL' ? level : null,
                source: source !== 'ALL' ? source : null,
            });
            setLogs(result.content);
            setTotalPages(result.totalPages);
            setTotalElements(result.totalElements);
        } catch {
            toast.error('Không thể tải nhật ký hệ thống');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(page, levelFilter, sourceFilter);
    }, [fetchLogs, page, levelFilter, sourceFilter]);

    const handleRefresh = () => {
        fetchLogs(page, levelFilter, sourceFilter);
    };

    const handleLevelChange = (level: LogLevel | 'ALL') => {
        setLevelFilter(level);
        setPage(0);
    };

    const handleSourceChange = (source: LogSource | 'ALL') => {
        setSourceFilter(source);
        setPage(0);
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                        Nhật ký hệ thống
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {totalElements > 0
                            ? `${totalElements} bản ghi – thiết bị của bạn`
                            : 'Xem log hoạt động và sự kiện của Smart Garden'}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                    {isLoading ? (
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
                    {(['ALL', ...LOG_LEVELS] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => handleLevelChange(level as LogLevel | 'ALL')}
                            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${levelFilter === level
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
                    onChange={(e) => handleSourceChange(e.target.value as LogSource | 'ALL')}
                    className="rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                    <option value="ALL">Tất cả nguồn</option>
                    {LOG_SOURCES.map((s) => (
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                                    Cấp độ
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">
                                    Nguồn
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">
                                    Thiết bị
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
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-teal-500 mx-auto" />
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Không có log nào</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
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
                                                {log.logSource}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {log.deviceName ?? <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                <span>{log.message}</span>
                                                {log.stackTrace && (
                                                    <details className="mt-1">
                                                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                                                            Stack trace
                                                        </summary>
                                                        <pre className="mt-1 text-xs text-slate-500 whitespace-pre-wrap font-mono">
                                                            {log.stackTrace}
                                                        </pre>
                                                    </details>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                {formatTimestamp(log.createdAt)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                        <p className="text-sm text-slate-500">
                            Trang {page + 1} / {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0 || isLoading}
                                className="p-1.5 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1 || isLoading}
                                className="p-1.5 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
