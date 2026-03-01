import React from 'react';
import { FileText, AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';
import type { SystemLog, LogLevel } from '../../types/dashboard';

interface LogTableProps {
    logs: SystemLog[];
    isLoading?: boolean;
}

export const LogTable: React.FC<LogTableProps> = ({ logs, isLoading = false }) => {
    const getLevelConfig = (level: LogLevel) => {
        switch (level) {
            case 'ERROR':
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    bgColor: 'bg-red-50',
                    textColor: 'text-red-600',
                    badgeBg: 'bg-red-100',
                };
            case 'WARNING':
                return {
                    icon: <AlertTriangle className="w-4 h-4" />,
                    bgColor: 'bg-amber-50',
                    textColor: 'text-amber-600',
                    badgeBg: 'bg-amber-100',
                };
            case 'INFO':
            default:
                return {
                    icon: <Info className="w-4 h-4" />,
                    bgColor: 'bg-blue-50',
                    textColor: 'text-blue-600',
                    badgeBg: 'bg-blue-100',
                };
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-600">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Nhật ký hệ thống</h3>
                    <p className="text-sm text-slate-500">5 bản ghi gần nhất</p>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map((log) => {
                        const config = getLevelConfig(log.logLevel);
                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-4 p-4 rounded-xl ${config.bgColor} transition-transform hover:scale-[1.01]`}
                            >
                                <div className={`p-2 rounded-lg ${config.badgeBg} ${config.textColor}`}>
                                    {config.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.badgeBg} ${config.textColor}`}>
                                            {log.logLevel}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {log.source}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 truncate">
                                        {log.message}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(log.timestamp)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
