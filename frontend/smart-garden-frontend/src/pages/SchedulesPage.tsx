import React, { useState } from 'react';
import {
    CalendarDays, Plus, Clock, Pencil, Trash2, X, Power,
    PowerOff
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { mockScheduleDetails } from '../mocks/smartGardenMocks';
import type { ScheduleDetail } from '../types/dashboard';

// ============================================
// CONSTANTS
// ============================================

const DAYS = [
    { key: 'MON', short: 'T2', full: 'Thứ 2' },
    { key: 'TUE', short: 'T3', full: 'Thứ 3' },
    { key: 'WED', short: 'T4', full: 'Thứ 4' },
    { key: 'THU', short: 'T5', full: 'Thứ 5' },
    { key: 'FRI', short: 'T6', full: 'Thứ 6' },
    { key: 'SAT', short: 'T7', full: 'Thứ 7' },
    { key: 'SUN', short: 'CN', full: 'Chủ nhật' },
];

const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} phút${s > 0 ? ` ${s}s` : ''}` : `${s} giây`;
};

// ============================================
// SCHEDULE CARD
// ============================================

const ScheduleCard: React.FC<{
    schedule: ScheduleDetail;
    onToggle: (id: number, active: boolean) => void;
    onEdit: (s: ScheduleDetail) => void;
    onDelete: (id: number) => void;
}> = ({ schedule, onToggle, onEdit, onDelete }) => {
    return (
        <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${schedule.isActive ? 'border-slate-100' : 'border-slate-100 opacity-60'
            }`}>
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${schedule.isActive
                            ? 'bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600'
                            : 'bg-slate-100 text-slate-400'
                            }`}>
                            <CalendarDays className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">{schedule.name}</h3>
                            <p className="text-xs text-slate-400">{schedule.deviceName}</p>
                        </div>
                    </div>
                    <Switch.Root
                        checked={schedule.isActive}
                        onCheckedChange={(checked) => onToggle(schedule.id, checked)}
                        className="w-11 h-6 bg-slate-200 rounded-full relative data-[state=checked]:bg-teal-500 transition-colors cursor-pointer"
                    >
                        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                    </Switch.Root>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-2xl font-bold text-slate-800">{schedule.time}</span>
                    <span className="text-sm text-slate-400 ml-2">• {formatDuration(schedule.duration)}</span>
                </div>

                {/* Days */}
                <div className="flex gap-1.5 mb-4">
                    {DAYS.map((day) => {
                        const active = schedule.daysOfWeek.includes(day.key);
                        return (
                            <span
                                key={day.key}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${active
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-100 text-slate-400'
                                    }`}
                                title={day.full}
                            >
                                {day.short}
                            </span>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => onEdit(schedule)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Sửa
                    </button>
                    <button
                        onClick={() => onDelete(schedule.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CREATE/EDIT MODAL
// ============================================

const ScheduleModal: React.FC<{
    schedule?: ScheduleDetail | null;
    onClose: () => void;
    onSave: (s: Partial<ScheduleDetail>) => void;
}> = ({ schedule, onClose, onSave }) => {
    const [name, setName] = useState(schedule?.name || '');
    const [time, setTime] = useState(schedule?.time || '06:00');
    const [duration, setDuration] = useState(schedule?.duration || 300);
    const [selectedDays, setSelectedDays] = useState<string[]>(schedule?.daysOfWeek || []);

    const toggleDay = (key: string) => {
        setSelectedDays((prev) =>
            prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
        );
    };

    const handleSubmit = () => {
        onSave({ name, time, duration, daysOfWeek: selectedDays });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">
                        {schedule ? 'Sửa lịch tưới' : 'Tạo lịch tưới mới'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên lịch tưới</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Tưới sáng sớm"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                    </div>

                    {/* Time */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Giờ tưới</label>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                    </div>

                    {/* Days */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Ngày trong tuần</label>
                        <div className="flex gap-2">
                            {DAYS.map((day) => (
                                <button
                                    key={day.key}
                                    type="button"
                                    onClick={() => toggleDay(day.key)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all ${selectedDays.includes(day.key)
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {day.short}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Thời gian tưới (giây)</label>
                        <input
                            type="number"
                            value={duration}
                            min={10}
                            max={3600}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                        <p className="text-xs text-slate-400 mt-1">{formatDuration(duration)}</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all">
                        {schedule ? 'Cập nhật' : 'Tạo lịch'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SCHEDULES PAGE
// ============================================

export const SchedulesPage: React.FC = () => {
    const [schedules, setSchedules] = useState<ScheduleDetail[]>(mockScheduleDetails);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleDetail | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const handleToggle = (id: number, isActive: boolean) => {
        setSchedules((prev) =>
            prev.map((s) => (s.id === id ? { ...s, isActive } : s))
        );
    };

    const handleEdit = (s: ScheduleDetail) => {
        setEditingSchedule(s);
        setModalOpen(true);
    };

    const handleCreate = () => {
        setEditingSchedule(null);
        setModalOpen(true);
    };

    const handleSave = (data: Partial<ScheduleDetail>) => {
        if (editingSchedule) {
            setSchedules((prev) =>
                prev.map((s) => (s.id === editingSchedule.id ? { ...s, ...data } : s))
            );
        } else {
            const newSchedule: ScheduleDetail = {
                id: Date.now(),
                deviceId: 1,
                deviceName: 'ESP32-Garden-01',
                isActive: true,
                name: data.name || 'Lịch mới',
                time: data.time || '06:00',
                duration: data.duration || 300,
                daysOfWeek: data.daysOfWeek || ['MON', 'WED', 'FRI'],
            };
            setSchedules((prev) => [...prev, newSchedule]);
        }
    };

    const handleDelete = (id: number) => {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        setDeleteConfirm(null);
    };

    const activeCount = schedules.filter((s) => s.isActive).length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Lịch tưới</h1>
                    <p className="text-slate-500 mt-1">Quản lý lịch tưới tự động cho các thiết bị</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Tạo lịch mới
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <CalendarDays className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Tổng lịch tưới</p>
                            <p className="text-xl font-bold text-slate-800">{schedules.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <Power className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Đang hoạt động</p>
                            <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                            <PowerOff className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Đã tắt</p>
                            <p className="text-xl font-bold text-slate-500">{schedules.length - activeCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Cards */}
            {schedules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {schedules.map((schedule) => (
                        <ScheduleCard
                            key={schedule.id}
                            schedule={schedule}
                            onToggle={handleToggle}
                            onEdit={handleEdit}
                            onDelete={(id) => setDeleteConfirm(id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                    <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-2">Chưa có lịch tưới nào</p>
                    <button onClick={handleCreate} className="text-teal-600 text-sm font-medium hover:underline">
                        Tạo lịch tưới đầu tiên
                    </button>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <ScheduleModal
                    schedule={editingSchedule}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSave}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirm !== null && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
                        <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Xóa lịch tưới?</h3>
                        <p className="text-sm text-slate-500 mb-6">Hành động này không thể hoàn tác.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                Hủy
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
