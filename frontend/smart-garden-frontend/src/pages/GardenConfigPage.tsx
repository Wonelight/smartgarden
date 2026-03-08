import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Sprout, Layers, Ruler, CalendarDays, Plus, Clock, Pencil, Trash2,
    X, Power, Loader2, Leaf, FlaskConical, Calendar, Info,
    BarChart3, ChevronRight, CheckCircle2, Brain, MoreVertical, ChevronDown, ChevronUp,
    Droplets, Lightbulb, Zap, Wifi, WifiOff, Settings2, Wind
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { cropSeasonApi } from '../api/cropSeason';
import { irrigationApi, type IrrigationConfigDetailResponse } from '../api/irrigation';
import { useMonitoringDevice } from '../contexts/MonitoringDeviceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cropApi, type CropLibraryListItem } from '../api/crop';
import { soilApi } from '../api/soil';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { mockScheduleDetails } from '../mocks/smartGardenMocks';
import type { ScheduleDetail } from '../types/dashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/Tooltip';
import { useDeviceSocket, type SensorEvent, type StatusEvent } from '../hooks/useDeviceSocket';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

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
    return m > 0 ? `${m} phút${s > 0 ? ` ${s}s` : ''} ` : `${s} giây`;
};

const parseDate = (dateVal: string | number[] | undefined): Date => {
    if (!dateVal) return new Date();
    if (Array.isArray(dateVal)) return new Date(dateVal[0], dateVal[1] - 1, dateVal[2]);
    return new Date(dateVal);
};

const stageColors: Record<string, string> = {
    initial: 'bg-sky-100 text-sky-700 border-sky-200',
    development: 'bg-amber-100 text-amber-700 border-amber-200',
    mid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    end: 'bg-slate-100 text-slate-600 border-slate-200',
};
const stageLabels: Record<string, string> = {
    initial: 'Khởi đầu', development: 'Phát triển', mid: 'Giữa mùa', end: 'Cuối mùa',
};

function getGrowthStage(crop: CropLibraryListItem | undefined, plantAgeDays: number): string {
    if (!crop) return 'initial';
    if (plantAgeDays <= crop.stageIniDays) return 'initial';
    if (plantAgeDays <= crop.stageIniDays + crop.stageDevDays) return 'development';
    if (plantAgeDays <= crop.stageIniDays + crop.stageDevDays + crop.stageMidDays) return 'mid';
    return 'end';
}

function getKcCurrent(crop: CropLibraryListItem | undefined, plantAgeDays: number): number {
    if (!crop) return 1.0;
    const stage = getGrowthStage(crop, plantAgeDays);
    if (stage === 'initial') return crop.kcIni;
    if (stage === 'mid') return crop.kcMid;
    if (stage === 'end') return crop.kcEnd;
    const ratio = (plantAgeDays - crop.stageIniDays) / Math.max(crop.stageDevDays, 1);
    return crop.kcIni + (crop.kcMid - crop.kcIni) * Math.min(1, ratio);
}

// ============================================================
// SCHEDULE CARD
// ============================================================

const ScheduleCard: React.FC<{
    schedule: ScheduleDetail;
    onToggle: (id: number, active: boolean) => void;
    onEdit: (s: ScheduleDetail) => void;
    onDelete: (id: number) => void;
}> = ({ schedule, onToggle, onEdit, onDelete }) => (
    <div className={`flex flex-col gap-1 p-5 lg:p-6 bg-white border ${schedule.isActive ? 'border-slate-100/50' : 'border-slate-100/30 opacity-60'} rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 ease-out group`}>
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl transition-colors duration-300 ${schedule.isActive ? 'bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 shadow-[0_4px_20px_rgb(20,184,166,0.15)]' : 'bg-slate-50 text-gray-400'} `}>
                    <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold tracking-tight text-slate-800 group-hover:text-teal-600 transition-colors duration-300">{schedule.name}</h3>
                    <p className="text-xs font-medium text-slate-500">{schedule.deviceName}</p>
                </div>
            </div>
            <Switch.Root
                checked={schedule.isActive}
                onCheckedChange={(checked) => onToggle(schedule.id, checked)}
                className="w-12 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-teal-500 transition-colors duration-300 cursor-pointer shadow-inner active:scale-95"
            >
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 translate-x-0.5 data-[state=checked]:translate-x-[26px]" />
            </Switch.Root>
        </div>
        <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-3xl font-bold tracking-tight text-slate-800">{schedule.time}</span>
            <span className="text-sm font-medium text-slate-500 ml-2 bg-slate-50 px-2 py-1 rounded-lg">• {formatDuration(schedule.duration)}</span>
        </div>
        <div className="flex gap-1.5 mb-5 mt-2">
            {DAYS.map((day) => {
                const active = schedule.daysOfWeek.includes(day.key);
                return (
                    <span
                        key={day.key}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-300 ${active ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' : 'bg-slate-50 text-gray-400'} `}
                        title={day.full}
                    >
                        {day.short}
                    </span>
                );
            })}
        </div>
        <div className="flex gap-2 pt-4 border-t border-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
                onClick={() => onEdit(schedule)}
                className="flex items-center justify-center flex-1 gap-1.5 px-4 py-2 font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all duration-300 ease-out active:scale-95 text-sm"
            >
                <Pencil className="w-4 h-4" /> Sửa
            </button>
            <button
                onClick={() => onDelete(schedule.id)}
                className="flex items-center justify-center flex-1 gap-1.5 px-4 py-2 font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all duration-300 ease-out active:scale-95 text-sm"
            >
                <Trash2 className="w-4 h-4" /> Xóa
            </button>
        </div>
    </div>
);

// ============================================================
// SCHEDULE MODAL
// ============================================================

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
        setSelectedDays((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
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
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Tên lịch tưới</label>
                        <input
                            type="text" value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Tưới sáng sớm"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Giờ tưới</label>
                        <input
                            type="time" value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Ngày trong tuần</label>
                        <div className="flex gap-2">
                            {DAYS.map((day) => (
                                <button
                                    key={day.key} type="button"
                                    onClick={() => toggleDay(day.key)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all ${selectedDays.includes(day.key) ? 'bg-teal-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} `}
                                >
                                    {day.short}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Thời gian tưới (giây)</label>
                        <input
                            type="number" value={duration} min={10} max={3600}
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

// ============================================================
// SCHEDULES TAB CONTENT
// ============================================================

const SchedulesTab: React.FC<{ deviceId: number | null; isAutoMode: boolean }> = ({ deviceId, isAutoMode }) => {
    const [schedules, setSchedules] = useState<ScheduleDetail[]>(mockScheduleDetails);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleDetail | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [isSchedulesOpen, setIsSchedulesOpen] = useState(false);

    const handleToggle = (id: number, isActive: boolean) => {
        setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
    };
    const handleEdit = (s: ScheduleDetail) => { setEditingSchedule(s); setModalOpen(true); };
    const handleCreate = () => { setEditingSchedule(null); setModalOpen(true); };
    const handleSave = (data: Partial<ScheduleDetail>) => {
        if (editingSchedule) {
            setSchedules((prev) => prev.map((s) => (s.id === editingSchedule.id ? { ...s, ...data } : s)));
        } else {
            const newSchedule: ScheduleDetail = {
                id: Date.now(), deviceId: 1, deviceName: 'ESP32-Garden-01',
                isActive: true, name: data.name || 'Lịch mới',
                time: data.time || '06:00', duration: data.duration || 300,
                daysOfWeek: data.daysOfWeek || ['MON', 'WED', 'FRI'],
            };
            setSchedules((prev) => [...prev, newSchedule]);
        }
    };
    const handleDelete = (id: number) => { setSchedules((prev) => prev.filter((s) => s.id !== id)); setDeleteConfirm(null); };

    const activeCount = schedules.filter((s) => s.isActive).length;


    if (!deviceId) {
        return (
            <div className="bg-white rounded-3xl p-10 border border-slate-100 text-center text-slate-400 mt-2">
                <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Chọn thiết bị để lập lịch tưới.
            </div>
        );
    }

    return (
        <div className="relative bg-white rounded-3xl p-6 lg:p-8 border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 mt-2 overflow-hidden">
            <div
                className="flex items-center justify-between cursor-pointer group select-none"
                onClick={() => setIsSchedulesOpen(!isSchedulesOpen)}
            >
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl"><CalendarDays className="w-5 h-5" /></div> Lập lịch tưới
                    </h2>
                </div>
                <div className="p-2 bg-slate-50 text-slate-400 group-hover:text-slate-600 rounded-full transition-colors flex shrink-0">
                    {isSchedulesOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </div>

            <div className={`relative transition-all duration-500 origin-top overflow-hidden ${isSchedulesOpen ? 'mt-8 opacity-100 max-h-[2000px]' : 'mt-0 opacity-0 max-h-0'} `}>
                {/* Disabled overlay when AUTO mode is active */}
                {isAutoMode && (
                    <div className="absolute inset-0 z-20 rounded-2xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 cursor-not-allowed">
                        <div className="flex items-center gap-2.5 px-5 py-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
                            <Brain className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-bold text-slate-600 tracking-tight">Chế độ AUTO đang quản lý lịch tưới</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Tắt AUTO để chỉnh sửa lịch thủ công</p>
                    </div>
                )}
                {/* Header row */}
                <div className="flex items-center justify-end mb-6">
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-bold tracking-tight hover:from-teal-600 hover:to-emerald-600 transition-all shadow-[0_4px_15px_rgb(20,184,166,0.3)] hover:shadow-[0_6px_20px_rgb(20,184,166,0.4)] active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Tạo lịch mới
                    </button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:bg-slate-50 transition-colors flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-100/50 text-teal-600"><CalendarDays className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Tổng lịch tưới</p>
                            <p className="text-xl font-extrabold tracking-tight text-slate-900 mt-0.5">{schedules.length}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:bg-slate-50 transition-colors flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-100/50 text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Đang bật</p>
                            <p className="text-xl font-extrabold tracking-tight text-slate-900 mt-0.5">{activeCount}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:bg-slate-50 transition-colors flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100/50 text-amber-500"><Clock className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sắp chạy tới</p>
                            <p className="text-xl font-extrabold tracking-tight text-slate-900 mt-0.5">08:00</p>
                        </div>
                    </div>
                </div>

                {/* Schedules list */}
                {schedules.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                        {schedules.map((schedule) => (
                            <ScheduleCard
                                key={schedule.id} schedule={schedule}
                                onToggle={handleToggle} onEdit={handleEdit}
                                onDelete={(id) => setDeleteConfirm(id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-12 text-center mt-6">
                        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium mb-3">Chưa có lịch tưới nào</p>
                        <button onClick={handleCreate} className="text-teal-600 text-sm font-bold tracking-tight hover:underline">
                            Tạo lịch tưới tự động đầu tiên
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <ScheduleModal schedule={editingSchedule} onClose={() => setModalOpen(false)} onSave={handleSave} />
            )}

            {/* Delete Confirm */}
            {deleteConfirm !== null && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
                        <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Xóa lịch tưới?</h3>
                        <p className="text-sm text-slate-500 mb-6">Hành động này không thể hoàn tác.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">Xóa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// GARDEN PROFILE TAB
// ============================================================

type AreaUnit = 'ha' | 'm2';

type GardenProfileTabProps = {
    deviceId: number | null;
    devices: any[];
    isAutoMode: boolean;
    onToggleAuto: (v: boolean) => void;
    controlPending: boolean;
    isConnected: boolean;
};

const GardenProfileTab: React.FC<GardenProfileTabProps> = ({ deviceId, devices, isAutoMode, onToggleAuto, controlPending, isConnected }) => {
    const queryClient = useQueryClient();
    const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
    const [isGardenInfoOpen, setIsGardenInfoOpen] = useState(false);

    // Garden area state
    const [areaValue, setAreaValue] = useState<string>('1000');
    const [areaUnit, setAreaUnit] = useState<AreaUnit>('m2');

    // Season form state
    const [cropId, setCropId] = useState<number | ''>('');
    const [soilId, setSoilId] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Default configuration state
    const [defaultCropId, setDefaultCropId] = useState<number | undefined>(undefined);
    const [defaultSoilId, setDefaultSoilId] = useState<number | undefined>(undefined);

    // ── Irrigation / pump config state ──
    const [irrigationDraft, setIrrigationDraft] = useState<Partial<IrrigationConfigDetailResponse>>({});

    const { data: irrigationConfig, isLoading: irrigationLoading } = useQuery({
        queryKey: ['irrigationConfig', deviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    useEffect(() => {
        if (irrigationConfig) setIrrigationDraft(irrigationConfig);
    }, [irrigationConfig]);

    const irrigationSaveMutation = useMutation({
        mutationFn: () => irrigationApi.userUpdateConfig(deviceId!, {
            pumpFlowRate: irrigationDraft.pumpFlowRate ?? undefined,
            nozzleCount:  irrigationDraft.nozzleCount  ?? undefined,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] }),
        onError: () => toast.error('Không thể lưu cấu hình máy bơm.'),
    });

    const setIrrigation = (key: keyof IrrigationConfigDetailResponse, value: number) =>
        setIrrigationDraft(prev => ({ ...prev, [key]: value }));

    const totalFlowLpm = (irrigationDraft.pumpFlowRate ?? 0.5) * (irrigationDraft.nozzleCount ?? 1);


    const { data: activeSeason, isLoading: seasonLoading } = useQuery({
        queryKey: ['activeSeason', deviceId],
        queryFn: () => cropSeasonApi.getActiveSeason(deviceId!),
        enabled: !!deviceId,
    });

    const { data: crops = [], isLoading: cropsLoading } = useQuery({
        queryKey: ['crops'],
        queryFn: cropApi.getAllCropLibraries,
    });

    const { data: soils = [], isLoading: soilsLoading } = useQuery({
        queryKey: ['soils'],
        queryFn: soilApi.getAllSoilLibraries,
    });

    const { data: recommendations = [], isLoading: recLoading } = useQuery({
        queryKey: ['cropRecommendations', deviceId],
        queryFn: () => cropSeasonApi.getRecommendations(deviceId!),
        enabled: !!deviceId,
    });

    // Load data from DB and updating state when device changes
    useEffect(() => {
        if (!deviceId || !devices.length) return;

        // Reset current selection so it can be re-populated
        setDefaultCropId(undefined);
        setDefaultSoilId(undefined);

        const currentDevice = devices.find(d => d.id === deviceId);
        if (currentDevice) {
            if (currentDevice.gardenArea) setAreaValue(currentDevice.gardenArea.toString());
            // Unit is not in DB yet, but m2 is default
            if (currentDevice.defaultCropId) {
                setDefaultCropId(currentDevice.defaultCropId);
            }
            if (currentDevice.defaultSoilId) {
                setDefaultSoilId(currentDevice.defaultSoilId);
            }
        }

        // Fallback to active season if no device defaults found
        if (activeSeason && crops.length > 0 && soils.length > 0) {
            setDefaultCropId(prev => prev ?? activeSeason.cropId);
            setDefaultSoilId(prev => prev ?? activeSeason.soilId);
        }
    }, [deviceId, devices.length, activeSeason, crops.length, soils.length]); // Re-run when device changes or list loads

    const saveConfigMutation = useMutation({
        mutationFn: (config: any) => deviceApi.saveGardenConfig(deviceId!, config),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myDevices'] });
            toast.success('Đã lưu thông số vườn thành công!');
        },
        onError: () => toast.error('Không thể lưu thông số vườn.'),
    });

    const handleSaveGardenConfig = () => {
        if (!deviceId) return;
        saveConfigMutation.mutate({
            gardenArea: areaM2, // Save as m2 to backend
            defaultCropId: defaultCropId,
            defaultSoilId: defaultSoilId,
        });
    };

    const startSeasonMutation = useMutation({
        mutationFn: () => cropSeasonApi.startNewSeason(deviceId!, {
            cropId: Number(cropId), soilId: Number(soilId), startDate,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSeason', deviceId] });
            setShowNewSeasonForm(false);
            toast.success('Đã bắt đầu vụ mùa mới!');
        },
        onError: () => toast.error('Không thể bắt đầu vụ mùa, vui lòng thử lại.'),
    });

    const endSeasonMutation = useMutation({
        mutationFn: () => cropSeasonApi.endActiveSeason(deviceId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSeason', deviceId] });
            toast.success('Đã kết thúc vụ mùa.');
        },
    });

    const selectedCrop = crops.find(c => c.id === Number(cropId));
    const activeCrop = crops.find(c => c.id === activeSeason?.cropId);
    const activeSoil = soils.find(s => s.id === activeSeason?.soilId);

    const plantAgeDays = activeSeason ? differenceInDays(new Date(), parseDate(activeSeason.startDate)) : 0;
    const currentStage = getGrowthStage(activeCrop, plantAgeDays);
    const kcCurrent = getKcCurrent(activeCrop, plantAgeDays);
    const totalDays = activeCrop
        ? activeCrop.stageIniDays + activeCrop.stageDevDays + activeCrop.stageMidDays + activeCrop.stageEndDays
        : 0;
    const progressPct = totalDays > 0 ? Math.min(100, (plantAgeDays / totalDays) * 100) : 0;

    // Compute display area
    const areaNum = parseFloat(areaValue) || 0;
    const areaM2 = areaUnit === 'ha' ? areaNum * 10000 : areaNum;
    const areaHa = areaUnit === 'm2' ? areaNum / 10000 : areaNum;

    if (!deviceId) {
        return (
            <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center text-slate-400">
                <Sprout className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Chọn thiết bị để xem hồ sơ vườn.
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ── CROP SEASON SECTION (MOVED TO TOP) ── */}
            {seasonLoading ? (
                <div className="bg-white rounded-3xl p-10 border border-slate-100/50 flex justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
            ) : activeSeason ? (
                <>
                    {/* Hero Card */}
                    <div className="relative overflow-hidden bg-white rounded-3xl p-8 pb-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 border border-slate-100/80 group">
                        {/* Apple-style mesh/blob background effects (very subtle) */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl group-hover:bg-teal-500/10 transition-all duration-700" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700" />

                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)] flex-shrink-0" />
                                        <span className="text-emerald-700 text-[11px] font-bold uppercase tracking-wide bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                            {activeSeason.cropName || (crops.find(c => c.id === defaultCropId)?.name || '-')} | {activeSeason.soilName || (soils.find(s => s.id === defaultSoilId)?.name || '-')} | {areaNum > 0 ? (areaUnit === 'm2' ? `${areaM2.toLocaleString('vi-VN')} m²` : `${areaHa.toFixed(4)} ha`) : '-'}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mt-1 text-slate-800">{activeSeason.cropName}</h2>
                                    <p className="text-slate-500 text-sm mt-2 font-medium flex items-center gap-1.5"><Layers className="w-4 h-4 opacity-70" /> {activeSeason.soilName}</p>
                                </div>
                                <div className="flex items-center gap-3 z-20">
                                    {/* AUTO / MANUAL compact toggle */}
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all duration-300 ${isAutoMode
                                        ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
                                        : 'bg-amber-50 border-amber-200/80 text-amber-700'
                                    }`}>
                                        <span className="text-[11px] font-bold tracking-wide select-none">
                                            {isAutoMode ? 'AUTO' : 'THỦ CÔNG'}
                                        </span>
                                        <Switch.Root
                                            checked={isAutoMode}
                                            onCheckedChange={onToggleAuto}
                                            disabled={!deviceId || controlPending}
                                            className={`w-10 h-5 rounded-full relative outline-none cursor-pointer transition-colors duration-300 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed ${isAutoMode ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                        >
                                            <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-300 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px] shadow-md" />
                                        </Switch.Root>
                                        {isConnected
                                            ? <Wifi className="w-3 h-3 opacity-70 shrink-0" />
                                            : <WifiOff className="w-3 h-3 opacity-40 shrink-0" />}
                                    </div>
                                    <span className={`px-4 py-2 rounded-2xl text-xs font-bold shadow-sm ${stageColors[currentStage]} bg-white ring-1 ring-slate-100`}>
                                        {stageLabels[currentStage]}
                                    </span>
                                    {/* More Menu */}
                                    <div className="relative group/menu">
                                        <button className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors shadow-sm focus:outline-none">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-1.5 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-300 origin-top-right z-50 text-left">
                                            <button
                                                onClick={() => setIsGardenInfoOpen(true)}
                                                className="flex items-center w-full gap-2 px-3 py-2.5 text-sm font-bold tracking-tight text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 outline-none active:scale-95 mb-1"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                Cấu hình vườn
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Bạn có chắc muốn kết thúc vụ mùa này?')) endSeasonMutation.mutate(); }}
                                                disabled={endSeasonMutation.isPending}
                                                className="flex items-center w-full gap-2 px-3 py-2.5 text-sm font-bold tracking-tight text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 outline-none active:scale-95"
                                            >
                                                {endSeasonMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                                                Kết thúc vụ mùa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                                <div className="flex justify-between text-xs text-slate-500 mb-2.5 font-bold tracking-wide">
                                    <span>Ngày {plantAgeDays}</span>
                                    <span>Tổng {totalDays} ngày</span>
                                </div>
                                <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressPct}% ` }}>
                                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 lg:gap-6">
                                <div className="bg-slate-50/50 rounded-2xl p-4 lg:p-5 border border-slate-100 hover:bg-slate-50 transition-colors duration-300 group/card">
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2 font-bold group-hover/card:text-teal-600 transition-colors">Ngày trồng</p>
                                    <p className="font-bold text-base lg:text-lg tracking-tight text-slate-800">{format(parseDate(activeSeason.startDate), 'dd/MM/yyyy')}</p>
                                </div>
                                <div className="bg-slate-50/50 rounded-2xl p-4 lg:p-5 border border-slate-100 hover:bg-slate-50 transition-colors duration-300 group/card">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2 font-bold group-hover/card:text-teal-600 transition-colors cursor-help border-b border-dashed border-slate-300 w-fit">Kc hiện tại</p>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Hệ số cây trồng (Crop Coefficient). Thay đổi theo từng giai đoạn phát triển của cây.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <p className="font-bold text-base lg:text-lg tracking-tight text-slate-800">{kcCurrent.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-50/50 rounded-2xl p-4 lg:p-5 border border-slate-100 hover:bg-slate-50 transition-colors duration-300 group/card">
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2 font-bold group-hover/card:text-teal-600 transition-colors">Độ sâu rễ tối đa</p>
                                    <p className="font-bold text-base lg:text-lg tracking-tight text-slate-800">{activeCrop?.maxRootDepth ?? '—'} <span className="text-xs font-medium text-slate-400 ml-0.5">m</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stage & Soil break down wrapper */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Stage breakdown */}
                        {activeCrop && (
                            <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
                                <h3 className="font-semibold text-slate-800 tracking-tight mb-5 flex items-center gap-2.5">
                                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><BarChart3 className="w-4 h-4" /></div> Vòng đời cây trồng
                                </h3>
                                <div className="flex h-4 rounded-full overflow-hidden gap-1 mb-6 shadow-inner bg-slate-50 p-0.5">
                                    {[
                                        { label: 'Khởi đầu', days: activeCrop.stageIniDays, color: 'bg-sky-400', stage: 'initial' },
                                        { label: 'Phát triển', days: activeCrop.stageDevDays, color: 'bg-amber-400', stage: 'development' },
                                        { label: 'Giữa mùa', days: activeCrop.stageMidDays, color: 'bg-emerald-400', stage: 'mid' },
                                        { label: 'Cuối mùa', days: activeCrop.stageEndDays, color: 'bg-slate-400', stage: 'end' },
                                    ].map(seg => (
                                        <div
                                            key={seg.stage}
                                            className={`h-full rounded-full ${seg.color} transition-all duration-500 ease-out hover:-translate-y-0.5 ${currentStage === seg.stage ? 'shadow-[0_0_10px_currentColor] scale-y-110 z-10' : 'opacity-50 hover:opacity-100'} `}
                                            style={{ width: `${(seg.days / totalDays) * 100}% ` }}
                                            title={`${seg.label}: ${seg.days} ngày`}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-4 gap-3 text-center">
                                    {[
                                        { label: 'Khởi đầu', days: activeCrop.stageIniDays, kc: activeCrop.kcIni, color: 'text-sky-600', bg: 'bg-sky-50' },
                                        { label: 'Phát triển', days: activeCrop.stageDevDays, kc: (activeCrop.kcIni + activeCrop.kcMid) / 2, color: 'text-amber-600', bg: 'bg-amber-50' },
                                        { label: 'Giữa mùa', days: activeCrop.stageMidDays, kc: activeCrop.kcMid, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        { label: 'Cuối mùa', days: activeCrop.stageEndDays, kc: activeCrop.kcEnd, color: 'text-slate-500', bg: 'bg-slate-50' },
                                    ].map(seg => (
                                        <div key={seg.label} className={`${seg.bg} rounded-2xl p-3 hover:-translate-y-1 transition-transform duration-300`}>
                                            <p className={`text-[10px] uppercase tracking-widest font-bold ${seg.color} `}>{seg.label}</p>
                                            <p className="text-slate-800 font-bold text-base mt-1.5">{seg.days}<span className="text-xs font-semibold text-slate-500 ml-0.5">d</span></p>
                                            <p className="text-slate-500 font-medium text-[10px] mt-0.5">Kc={seg.kc.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Soil info */}
                        {activeSoil && (
                            <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
                                <h3 className="font-semibold text-slate-800 tracking-tight mb-5 flex items-center gap-2.5">
                                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Layers className="w-4 h-4" /></div> Thông tin đất: <span className="text-amber-600 ml-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">{activeSoil.name}</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="flex flex-col justify-center items-center text-center p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl hover:bg-blue-50 transition-colors duration-300">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="text-[10px] text-blue-600 uppercase tracking-widest font-bold mb-1.5 cursor-help border-b border-dashed border-blue-200">Field Capacity</p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Độ ẩm tối đa mà đất có thể giữ lại sau khi thoát nước tự do.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <p className="text-2xl font-bold tracking-tight text-blue-700">{activeSoil.fieldCapacity}<span className="text-sm font-semibold opacity-60 ml-0.5">%</span></p>
                                    </div>
                                    <div className="flex flex-col justify-center items-center text-center p-4 bg-rose-50/50 border border-rose-100/50 rounded-2xl hover:bg-rose-50 transition-colors duration-300">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="text-[10px] text-rose-600 uppercase tracking-widest font-bold mb-1.5 cursor-help border-b border-dashed border-rose-200">Wilting Point</p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Điểm héo vĩnh viễn: Độ ẩm mà tại đó cây không thể hút nước được nữa.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <p className="text-2xl font-bold tracking-tight text-rose-700">{activeSoil.wiltingPoint}<span className="text-sm font-semibold opacity-60 ml-0.5">%</span></p>
                                    </div>
                                    <div className="flex flex-col justify-center items-center text-center p-4 bg-teal-50/50 border border-teal-100/50 rounded-2xl hover:bg-teal-50 transition-colors duration-300">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="text-[10px] text-teal-600 uppercase tracking-widest font-bold mb-1.5 cursor-help border-b border-dashed border-teal-200">Inf. Ratio</p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Tỷ lệ thấm nước vào các lớp đất.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <p className="text-2xl font-bold tracking-tight text-teal-700">
                                            {activeSoil.infiltrationShallowRatio != null
                                                ? `${(activeSoil.infiltrationShallowRatio * 100).toFixed(0)} `
                                                : '70'}<span className="text-sm font-semibold opacity-60 ml-0.5">%</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                </>
            ) : (
                /* NO ACTIVE SEASON */
                <div className="space-y-6">
                    {/* Recommendations */}
                    {recommendations.length > 0 && !showNewSeasonForm && (
                        <div className="bg-gradient-to-br from-teal-50/50 to-emerald-50/50 rounded-3xl p-6 lg:p-8 border border-teal-100/50 shadow-[0_8px_30px_rgb(20,184,166,0.05)]">
                            <h3 className="font-semibold text-slate-800 tracking-tight mb-5 flex items-center gap-2.5 text-base">
                                <div className="p-2 bg-teal-100/50 border border-teal-200/50 text-teal-600 rounded-xl"><Brain className="w-5 h-5" /></div> Gợi ý cây trồng theo thời tiết hiện tại
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recLoading
                                    ? <div className="col-span-full flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
                                    : recommendations.slice(0, 3).map(rec => (
                                        <button
                                            key={rec.cropId} type="button"
                                            onClick={() => { setCropId(rec.cropId); setShowNewSeasonForm(true); }}
                                            className="w-full text-left p-5 rounded-2xl bg-white border border-slate-100/50 hover:border-teal-200 hover:shadow-[0_8px_30px_rgb(20,184,166,0.08)] hover:-translate-y-1 transition-all duration-300 ease-out group active:scale-95 flex flex-col justify-between h-full"
                                        >
                                            <div className="mb-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="font-bold text-slate-800 tracking-tight group-hover:text-teal-600 transition-colors text-lg">{rec.cropName}</p>
                                                    <span className={`text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded-full border ${rec.matchScore > 0.8 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'} `}>
                                                        {Math.round(rec.matchScore * 100)}% MATCH
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium text-slate-500 leading-relaxed">{rec.reason}</p>
                                            </div>
                                            <div className="flex items-center text-teal-600 font-semibold text-xs opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 mt-auto">
                                                Bắt đầu trồng <ChevronRight className="w-4 h-4 ml-1" />
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}

                    {!showNewSeasonForm ? (
                        <div className="relative bg-white rounded-3xl border border-dashed border-slate-200 p-12 lg:p-16 text-center hover:bg-slate-50/50 transition-colors duration-500">
                            {/* More Menu */}
                            <div className="absolute top-4 right-4 group/menu">
                                <button className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors shadow-sm focus:outline-none">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-1.5 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-300 origin-top-right z-50 text-left">
                                    <button
                                        onClick={() => setIsGardenInfoOpen(true)}
                                        className="flex items-center w-full gap-2 px-3 py-2.5 text-sm font-bold tracking-tight text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 outline-none active:scale-95"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        Cấu hình vườn
                                    </button>
                                </div>
                            </div>

                            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100/50 mt-4">
                                <Sprout className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight text-slate-800 mb-3">Chưa có vụ mùa nào</h3>
                            <p className="text-slate-500 font-medium text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                                Bắt đầu một vụ mùa để AI có thể tính toán lượng nước bốc thoát hơi (ETc) và dự báo chính xác hơn.
                            </p>
                            <button
                                onClick={() => setShowNewSeasonForm(true)}
                                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl font-bold tracking-tight hover:from-teal-600 hover:to-emerald-600 shadow-[0_8px_20px_rgb(20,184,166,0.25)] hover:shadow-[0_8px_25px_rgb(20,184,166,0.35)] transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95"
                            >
                                <Plus className="w-5 h-5" /> Bắt đầu vụ mùa mới
                            </button>
                        </div>
                    ) : (
                        /* NEW SEASON FORM */
                        <div className="bg-white rounded-3xl border border-slate-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-500">
                            <div className="p-6 lg:p-8 border-b border-slate-100/80 bg-gradient-to-br from-teal-50/50 to-white">
                                <h3 className="font-bold tracking-tight text-xl text-slate-800 flex items-center gap-3">
                                    <div className="p-2.5 bg-white shadow-sm border border-teal-100 rounded-xl"><FlaskConical className="w-5 h-5 text-teal-600" /></div> Vụ mùa mới
                                </h3>
                                <p className="text-sm font-medium text-slate-500 mt-3 md:ml-14">Thông tin này giúp AI tính Kc, TAW, RAW để dự báo tưới tiêu chính xác.</p>
                            </div>
                            <div className="p-6 lg:p-8 space-y-8">
                                {/* Crop select */}
                                <div>
                                    <label className="block text-sm tracking-tight font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Leaf className="w-4 h-4 text-emerald-500" /> Loại cây trồng
                                    </label>
                                    {cropsLoading
                                        ? <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                                        : (
                                            <Select value={cropId ? cropId.toString() : undefined} onValueChange={(val) => setCropId(Number(val))}>
                                                <SelectTrigger className="w-full h-[52px] px-5 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-300 hover:bg-slate-50 cursor-pointer">
                                                    <SelectValue placeholder="-- Chọn cây trồng --" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-slate-100 shadow-xl max-h-60">
                                                    {crops.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )
                                    }
                                    {selectedCrop && (
                                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                            {[
                                                { label: 'Kc_ini', val: selectedCrop.kcIni },
                                                { label: 'Kc_mid', val: selectedCrop.kcMid },
                                                { label: 'Kc_end', val: selectedCrop.kcEnd },
                                                { label: 'Root Depth', val: `${selectedCrop.maxRootDepth} m` },
                                            ].map(item => (
                                                <div key={item.label} className="bg-teal-50/50 border border-teal-100/50 rounded-2xl p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold mb-1">{item.label}</p>
                                                    <p className="font-extrabold text-teal-900 text-sm tracking-tight">{item.val}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Soil select */}
                                <div>
                                    <label className="block text-sm tracking-tight font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-amber-500" /> Loại đất
                                    </label>
                                    {soilsLoading
                                        ? <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                                        : (
                                            <Select value={soilId ? soilId.toString() : undefined} onValueChange={(val) => setSoilId(Number(val))}>
                                                <SelectTrigger className="w-full h-[52px] px-5 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-300 hover:bg-slate-50 cursor-pointer">
                                                    <SelectValue placeholder="-- Chọn loại đất --" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-slate-100 shadow-xl max-h-60">
                                                    {soils.map(s => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>
                                                            {s.name} (FC: {s.fieldCapacity}% | WP: {s.wiltingPoint}%)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )
                                    }
                                    {soils.find(s => s.id === Number(soilId)) && (() => {
                                        const sel = soils.find(s => s.id === Number(soilId))!;
                                        const taw = ((sel.fieldCapacity - sel.wiltingPoint) * 0.003).toFixed(1);
                                        return (
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                                                <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-1">Field Cap.</p>
                                                    <p className="font-extrabold text-blue-900 text-sm tracking-tight">{sel.fieldCapacity}%</p>
                                                </div>
                                                <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-rose-600 font-bold mb-1">Wilting Pt.</p>
                                                    <p className="font-extrabold text-rose-900 text-sm tracking-tight">{sel.wiltingPoint}%</p>
                                                </div>
                                                <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1">TAW (~0.3m)</p>
                                                    <p className="font-extrabold text-amber-900 text-sm tracking-tight">{taw} mm</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Start date */}
                                <div>
                                    <label className="block text-sm tracking-tight font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-indigo-500" /> Ngày bắt đầu trồng
                                    </label>
                                    <input
                                        type="date" value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-300 cursor-pointer hover:bg-slate-50"
                                    />
                                </div>

                                <div className="flex items-start gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0"><Info className="w-5 h-5" /></div>
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed mt-0.5">
                                        Thông tin vụ mùa sẽ được gửi tới AI Service khi dự báo tưới tiêu. Hệ thống sẽ tự động tính <strong className="text-slate-800">giai đoạn sinh trưởng</strong>, <strong className="text-slate-800">hệ số cây trồng Kc</strong> và <strong className="text-slate-800">chiều sâu rễ</strong> để tối ưu lượng nước nhất có thể.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewSeasonForm(false)}
                                        className="flex-none px-6 py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-600 text-sm hover:bg-slate-50 hover:border-gray-300 transition-all duration-300 ease-out active:scale-95"
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!cropId || !soilId || !startDate) { toast.error('Vui lòng điền đầy đủ thông tin'); return; }
                                            startSeasonMutation.mutate();
                                        }}
                                        disabled={!cropId || !soilId || startSeasonMutation.isPending}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold text-sm tracking-tight hover:from-teal-600 hover:to-emerald-600 shadow-[0_8px_20px_rgb(20,184,166,0.25)] hover:shadow-[0_8px_25px_rgb(20,184,166,0.35)] disabled:opacity-60 disabled:shadow-none transition-all duration-300 ease-out active:scale-95"
                                    >
                                        {startSeasonMutation.isPending
                                            ? <Loader2 className="w-5 h-5 animate-spin" />
                                            : <CheckCircle2 className="w-5 h-5" />
                                        }
                                        {startSeasonMutation.isPending ? 'Đang thiết lập...' : 'Bắt đầu vụ mùa'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── GARDEN INFO MODAL ── */}
            {isGardenInfoOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl p-6 lg:p-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100/80">
                            <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Ruler className="w-5 h-5" /></div> Cấu hình thông số vườn
                            </h2>
                            <button onClick={() => setIsGardenInfoOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors outline-none">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                            {/* Area input */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold tracking-tight text-slate-800">Diện tích vườn</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        value={areaValue}
                                        onChange={e => setAreaValue(e.target.value)}
                                        placeholder="Nhập diện tích..."
                                        className="flex-1 px-4 py-3.5 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300"
                                    />
                                    {/* Unit toggle */}
                                    <div className="flex bg-slate-100/80 rounded-2xl p-1 gap-0.5 border border-slate-200/50">
                                        {(['m2', 'ha'] as AreaUnit[]).map(unit => (
                                            <button
                                                key={unit}
                                                type="button"
                                                onClick={() => {
                                                    if (unit === areaUnit) return;
                                                    if (unit === 'ha') {
                                                        setAreaValue(((parseFloat(areaValue) || 0) / 10000).toFixed(4));
                                                    } else {
                                                        setAreaValue(((parseFloat(areaValue) || 0) * 10000).toFixed(0));
                                                    }
                                                    setAreaUnit(unit);
                                                }}
                                                className={`px-4 py-1.5 rounded-xl text-sm font-bold tracking-tight transition-all duration-300 active:scale-95 ${areaUnit === unit
                                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    } `}
                                            >
                                                {unit === 'm2' ? 'm²' : 'ha'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {areaNum > 0 && (
                                    <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block">
                                        ≈ {areaUnit === 'm2'
                                            ? `${areaHa.toFixed(4)} ha`
                                            : `${areaM2.toLocaleString('vi-VN')} m²`}
                                    </p>
                                )}
                            </div>

                            {/* Quick crop select (lightweight – not tied to season) */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold tracking-tight text-slate-800 flex items-center gap-2">
                                    <Leaf className="w-4 h-4 text-emerald-500" /> Loại cây trồng mặc định
                                </label>
                                {cropsLoading
                                    ? <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                                    : (
                                        <Select value={defaultCropId ? defaultCropId.toString() : undefined} onValueChange={(val) => setDefaultCropId(Number(val))}>
                                            <SelectTrigger className="w-full h-[52px] px-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 cursor-pointer">
                                                <SelectValue placeholder="-- Chọn cây trồng --" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-slate-100 shadow-xl max-h-60 z-[70]">
                                                {crops.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )
                                }
                            </div>

                            {/* Quick soil select */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold tracking-tight text-slate-800 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-amber-500" /> Loại đất mặc định
                                </label>
                                {soilsLoading
                                    ? <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                                    : (
                                        <Select value={defaultSoilId ? defaultSoilId.toString() : undefined} onValueChange={(val) => setDefaultSoilId(Number(val))}>
                                            <SelectTrigger className="w-full h-[52px] px-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all duration-300 cursor-pointer">
                                                <SelectValue placeholder="-- Chọn loại đất --" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-slate-100 shadow-xl max-h-60 z-[70]">
                                                {soils.map(s => (
                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                        {s.name} (FC: {s.fieldCapacity}% | WP: {s.wiltingPoint}%)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )
                                }
                            </div>
                        </div>

                        {/* ── Pump config section ── */}
                        <div className="mt-8 pt-6 border-t border-slate-100/80">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Settings2 className="w-4 h-4" /></div>
                                Cấu hình máy bơm
                            </h3>
                            {irrigationLoading ? (
                                <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Flow rate */}
                                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Lưu lượng vòi bơm</label>
                                        <p className="text-xs text-slate-400 mb-3">L/phút cho mỗi vòi</p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={irrigationDraft.pumpFlowRate ?? 0.5}
                                                min={0.05} max={50} step={0.05}
                                                onChange={e => setIrrigation('pumpFlowRate', parseFloat(e.target.value))}
                                                className="flex-1 px-4 py-3.5 bg-white border border-slate-200/80 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                                            />
                                            <span className="text-sm text-slate-500 font-medium shrink-0">L/min</span>
                                        </div>
                                    </div>
                                    {/* Nozzle count */}
                                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Số cây / vòi bơm</label>
                                        <p className="text-xs text-slate-400 mb-3">Mỗi cây có 1 vòi tưới</p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={irrigationDraft.nozzleCount ?? 1}
                                                min={1} max={500} step={1}
                                                onChange={e => setIrrigation('nozzleCount', parseInt(e.target.value, 10))}
                                                className="flex-1 px-4 py-3.5 bg-white border border-slate-200/80 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                                            />
                                            <span className="text-sm text-slate-500 font-medium shrink-0">vòi</span>
                                        </div>
                                    </div>
                                    {/* Computed total */}
                                    <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Wind className="w-4 h-4 text-blue-500" />
                                            <span className="text-sm font-semibold text-blue-700">Tổng lưu lượng</span>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-700">
                                            {totalFlowLpm.toFixed(2)}
                                            <span className="text-base font-medium ml-1">L/min</span>
                                        </p>
                                        <p className="text-xs text-blue-400 mt-1">≈ {(totalFlowLpm / 60).toFixed(3)} L/s</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100/80">
                            <button
                                onClick={() => setIsGardenInfoOpen(false)}
                                className="px-6 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold tracking-tight hover:bg-slate-100 transition-colors outline-none"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={() => {
                                    handleSaveGardenConfig();
                                    irrigationSaveMutation.mutate();
                                    setIsGardenInfoOpen(false);
                                }}
                                disabled={saveConfigMutation.isPending || irrigationSaveMutation.isPending}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl text-sm font-bold tracking-tight hover:from-indigo-600 hover:to-indigo-700 shadow-sm transition-all duration-300 active:scale-95 disabled:opacity-60 outline-none"
                            >
                                {(saveConfigMutation.isPending || irrigationSaveMutation.isPending)
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <CheckCircle2 className="w-4 h-4" />}
                                Lưu thông số
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// ============================================================
// DEVICE CONTROL TAB
// ============================================================

type DeviceControlTabProps = {
    deviceId: number | null;
    isAutoMode: boolean;
    pumpState: boolean;
    lightState: boolean;
    onTogglePump: (on: boolean) => void;
    onToggleLight: (on: boolean) => void;
    isConnected: boolean;
};

const DeviceControlTab: React.FC<DeviceControlTabProps> = ({
    deviceId, isAutoMode,
    pumpState, lightState, onTogglePump, onToggleLight,
    isConnected,
}) => {
    const [isControlOpen, setIsControlOpen] = useState(false);

    if (!deviceId) {
        return (
            <div className="bg-white rounded-3xl p-10 border border-slate-100 text-center text-slate-400">
                <Zap className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Chọn thiết bị để điều khiển.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 mt-2 overflow-hidden">
            <div
                className="flex items-center justify-between cursor-pointer group select-none"
                onClick={() => setIsControlOpen(!isControlOpen)}
            >
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Zap className="w-5 h-5" /></div>
                        Điều khiển thiết bị
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    {/* Connection indicator */}
                    {isControlOpen && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 ${isConnected
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-50 text-slate-400 border border-slate-100'
                            }`}>
                            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            {isConnected ? 'LIVE' : 'OFFLINE'}
                        </div>
                    )}
                    <div className="p-2 bg-slate-50 text-slate-400 group-hover:text-slate-600 rounded-full transition-colors flex shrink-0">
                        {isControlOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            <div className={`transition-all duration-500 origin-top overflow-hidden ${isControlOpen ? 'mt-8 opacity-100 max-h-[2000px]' : 'mt-0 opacity-0 max-h-0'}`}>

                {/* Manual Control Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pump Card */}
                    <div className={`relative rounded-2xl border p-6 transition-all duration-300 ${isAutoMode
                        ? 'bg-slate-50/50 border-slate-100 opacity-80'
                        : 'bg-white border-slate-200/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5'
                        }`}>
                        {isAutoMode && (
                            <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center cursor-not-allowed">
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl transition-all duration-300 ${pumpState
                                    ? 'bg-blue-100 text-blue-600 shadow-[0_4px_20px_rgb(59,130,246,0.15)]'
                                    : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    <Droplets className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 tracking-tight">Bơm nước</h3>
                                    <p className="text-xs font-medium mt-0.5">
                                        {pumpState
                                            ? <span className="text-blue-600">Đang bật</span>
                                            : <span className="text-slate-400">Đang tắt</span>}
                                    </p>
                                </div>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${pumpState
                                ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                : 'bg-slate-200'
                                }`} />
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/80">
                            <span className="text-sm font-medium text-slate-600">Công tắc Bơm</span>
                            <Switch.Root
                                checked={pumpState}
                                onCheckedChange={onTogglePump}
                                disabled={!deviceId || isAutoMode}
                                className="w-14 h-7 bg-slate-200 rounded-full relative data-[state=checked]:bg-blue-500 outline-none cursor-pointer transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                            >
                                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-200 translate-x-1 will-change-transform data-[state=checked]:translate-x-8 shadow-md" />
                            </Switch.Root>
                        </div>
                    </div>

                    {/* Light Card */}
                    <div className={`relative rounded-2xl border p-6 transition-all duration-300 ${isAutoMode
                        ? 'bg-slate-50/50 border-slate-100 opacity-60'
                        : 'bg-white border-slate-200/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5'
                        }`}>
                        {isAutoMode && (
                            <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center cursor-not-allowed">
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl transition-all duration-300 ${lightState
                                    ? 'bg-yellow-100 text-yellow-600 shadow-[0_4px_20px_rgb(234,179,8,0.15)]'
                                    : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    <Lightbulb className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 tracking-tight">Đèn chiếu sáng</h3>
                                    <p className="text-xs font-medium mt-0.5">
                                        {lightState
                                            ? <span className="text-yellow-600">Đang sáng</span>
                                            : <span className="text-slate-400">Đang tắt</span>}
                                    </p>
                                </div>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${lightState
                                ? 'bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                                : 'bg-slate-200'
                                }`} />
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/80">
                            <span className="text-sm font-medium text-slate-600">Công tắc Đèn</span>
                            <Switch.Root
                                checked={lightState}
                                onCheckedChange={onToggleLight}
                                disabled={!deviceId || isAutoMode}
                                className="w-14 h-7 bg-slate-200 rounded-full relative data-[state=checked]:bg-yellow-500 outline-none cursor-pointer transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                            >
                                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-200 translate-x-1 will-change-transform data-[state=checked]:translate-x-8 shadow-md" />
                            </Switch.Root>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};

// ============================================================
// MAIN PAGE
// ============================================================

export const GardenConfigPage: React.FC = () => {
    const { selectedDeviceId: deviceId } = useMonitoringDevice();

    const { data: devices = [] } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
    });

    const currentDevice = devices.find(d => d.id === deviceId);
    const currentDeviceCode = currentDevice?.deviceCode ?? null;

    // ── Shared device-control state (used by both hero card toggle & DeviceControlTab) ──
    const [optimisticPump, setOptimisticPump] = useState<boolean | null>(null);
    const [optimisticLight, setOptimisticLight] = useState<boolean | null>(null);
    const [optimisticAuto, setOptimisticAuto] = useState<boolean | null>(null);
    const pumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [liveSensor, setLiveSensor] = useState<SensorEvent | null>(null);
    const [liveStatus, setLiveStatus] = useState<StatusEvent | null>(null);

    const handleSensorWs = useCallback((data: SensorEvent) => {
        setLiveSensor(data);
        setOptimisticPump(null);
        setOptimisticLight(null);
    }, []);

    const handleStatusWs = useCallback((data: StatusEvent) => {
        setLiveStatus(data);
        if (data.pumpState !== undefined || data.lightState !== undefined) {
            setLiveSensor(prev => {
                if (!prev) return { pumpState: data.pumpState, lightState: data.lightState };
                return {
                    ...prev,
                    pumpState: data.pumpState !== undefined ? data.pumpState : prev.pumpState,
                    lightState: data.lightState !== undefined ? data.lightState : prev.lightState,
                };
            });
            setOptimisticPump(null);
            setOptimisticLight(null);
        }
        if (data.manualMode !== undefined) {
            setOptimisticAuto(null);
        }
    }, []);

    const { isConnected } = useDeviceSocket({
        deviceCode: currentDeviceCode,
        onSensorData: handleSensorWs,
        onStatusChange: handleStatusWs,
        enabled: !!currentDeviceCode,
    });

    const controlMutation = useMutation({
        mutationFn: ({ controlType, action }: { controlType: 'PUMP' | 'LED' | 'SYSTEM', action: 'ON' | 'OFF' | 'TOGGLE' }) =>
            deviceApi.sendControlCommand(deviceId!, controlType, action),
        onSuccess: () => {},
        onError: () => toast.error('Lỗi khi điều khiển thiết bị'),
    });

    const pumpState = optimisticPump ?? liveSensor?.pumpState ?? false;
    const lightState = optimisticLight ?? liveSensor?.lightState ?? false;
    const isManualMode = liveStatus?.manualMode ?? false;
    const isAutoMode = optimisticAuto ?? !isManualMode;

    const handleToggleAuto = useCallback((checked: boolean) => {
        if (checked) {
            setOptimisticAuto(true);
            controlMutation.mutate({ controlType: 'SYSTEM', action: 'OFF' }, {
                onSuccess: () => toast.success('Đã bật chế độ tự động!'),
                onError: () => setOptimisticAuto(null),
            });
        } else {
            setOptimisticAuto(false);
            controlMutation.mutate({ controlType: 'PUMP', action: pumpState ? 'ON' : 'OFF' }, {
                onSuccess: () => toast.success('Đã chuyển sang điều khiển thủ công.'),
                onError: () => setOptimisticAuto(null),
            });
        }
    }, [pumpState, controlMutation]);

    const handleTogglePump = useCallback((checked: boolean) => {
        setOptimisticPump(checked);
        if (pumpTimeoutRef.current) clearTimeout(pumpTimeoutRef.current);
        pumpTimeoutRef.current = setTimeout(() => {
            controlMutation.mutate({ controlType: 'PUMP', action: checked ? 'ON' : 'OFF' }, {
                onSuccess: () => toast.success('Điều khiển thành công!'),
                onError: () => setOptimisticPump(null),
            });
        }, 600);
    }, [controlMutation]);

    const handleToggleLight = useCallback((checked: boolean) => {
        setOptimisticLight(checked);
        if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
        lightTimeoutRef.current = setTimeout(() => {
            controlMutation.mutate({ controlType: 'LED', action: checked ? 'ON' : 'OFF' }, {
                onSuccess: () => toast.success('Điều khiển thành công!'),
                onError: () => setOptimisticLight(null),
            });
        }, 600);
    }, [controlMutation]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cấu hình vườn</h1>
                    <p className="text-slate-500 mt-1 text-sm">Thiết lập thông tin vườn, vụ mùa và lịch tưới tự động</p>
                </div>
            </div>

            {/* Combined Content */}
            <div className="space-y-6 pb-20">
                <section>
                    <GardenProfileTab
                        deviceId={deviceId}
                        devices={devices}
                        isAutoMode={isAutoMode}
                        onToggleAuto={handleToggleAuto}
                        controlPending={controlMutation.isPending}
                        isConnected={isConnected}
                    />
                </section>

                <section>
                    <DeviceControlTab
                        deviceId={deviceId}
                        isAutoMode={isAutoMode}
                        pumpState={pumpState}
                        lightState={lightState}
                        onTogglePump={handleTogglePump}
                        onToggleLight={handleToggleLight}
                        isConnected={isConnected}
                    />
                </section>

                <section>
                    <SchedulesTab deviceId={deviceId} isAutoMode={isAutoMode} />
                </section>
            </div>
        </div>
    );
};
