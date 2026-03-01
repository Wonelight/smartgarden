import React from 'react';
import { Calendar, Clock, Droplets, Power, ChevronRight } from 'lucide-react';
import type { Schedule } from '../../types/dashboard';

interface ScheduleListProps {
    schedules: Schedule[];
    onToggle?: (id: number, isActive: boolean) => void;
    isLoading?: boolean;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
    schedules,
    onToggle,
    isLoading = false
}) => {
    const dayLabels: Record<string, string> = {
        MON: 'T2',
        TUE: 'T3',
        WED: 'T4',
        THU: 'T5',
        FRI: 'T6',
        SAT: 'T7',
        SUN: 'CN',
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        return `${Math.floor(seconds / 60)}p ${seconds % 60}s`;
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Lịch tưới định kỳ</h3>
                        <p className="text-sm text-slate-500">{schedules.length} lịch đã thiết lập</p>
                    </div>
                </div>
                <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                    Xem tất cả
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {schedules.map((schedule) => (
                        <div
                            key={schedule.id}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${schedule.isActive
                                    ? 'border-emerald-200 bg-emerald-50/50'
                                    : 'border-slate-200 bg-slate-50/50'
                                }`}
                        >
                            <div className={`p-3 rounded-xl ${schedule.isActive
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                <Clock className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg font-bold text-slate-800">
                                        {schedule.time}
                                    </span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${schedule.isActive
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-slate-200 text-slate-500'
                                        }`}>
                                        {schedule.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>
                                            {schedule.daysOfWeek.map(d => dayLabels[d]).join(', ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Droplets className="w-3.5 h-3.5" />
                                        <span>{formatDuration(schedule.duration)}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onToggle?.(schedule.id, !schedule.isActive)}
                                className={`p-2.5 rounded-xl transition-colors ${schedule.isActive
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                    }`}
                            >
                                <Power className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
