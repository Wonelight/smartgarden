import React, { useState, useEffect } from 'react';
import {
    Settings2, Droplets, Zap, Power, Loader2,
    Minus, Plus, Gauge, Brain,
    Thermometer, Wind, Sun, AlertCircle,
    Sprout, Leaf, Calendar, Plus as PlusIcon,
    ChevronRight, CheckCircle2, Info, BarChart3,
    Layers, FlaskConical, Flower2, ListChecks
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { irrigationApi } from '../api/irrigation';
import { sensorApi } from '../api/sensor';
import { cropSeasonApi } from '../api/cropSeason';
import { cropApi, type CropLibraryListItem } from '../api/crop';
import { soilApi } from '../api/soil';
import type { IrrigationConfig } from '../types/dashboard';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

const fallbackConfig: IrrigationConfig = {
    id: 0, deviceId: 0, autoMode: false, fuzzyEnabled: false, aiEnabled: false,
    soilMoistureMin: 30, soilMoistureMax: 70, wateringDuration: 30,
};

const parseDate = (dateVal: string | number[] | undefined): Date => {
    if (!dateVal) return new Date();
    if (Array.isArray(dateVal)) return new Date(dateVal[0], dateVal[1] - 1, dateVal[2]);
    return new Date(dateVal);
};

// ============================================================
// GROWTH STAGE INFO
// ============================================================
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
    // development: interpolate
    const ratio = (plantAgeDays - crop.stageIniDays) / Math.max(crop.stageDevDays, 1);
    return crop.kcIni + (crop.kcMid - crop.kcIni) * Math.min(1, ratio);
}

// ============================================================
// GARDEN PROFILE TAB
// ============================================================
const GardenProfileTab: React.FC<{ deviceId: number | null }> = ({ deviceId }) => {
    const queryClient = useQueryClient();
    const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);

    // Form state
    const [cropId, setCropId] = useState<number | ''>('');
    const [soilId, setSoilId] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

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

    const startSeasonMutation = useMutation({
        mutationFn: () => cropSeasonApi.startNewSeason(deviceId!, {
            cropId: Number(cropId),
            soilId: Number(soilId),
            startDate,
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

    const plantAgeDays = activeSeason
        ? differenceInDays(new Date(), parseDate(activeSeason.startDate))
        : 0;
    const currentStage = getGrowthStage(activeCrop, plantAgeDays);
    const kcCurrent = getKcCurrent(activeCrop, plantAgeDays);
    const totalDays = activeCrop
        ? activeCrop.stageIniDays + activeCrop.stageDevDays + activeCrop.stageMidDays + activeCrop.stageEndDays
        : 0;
    const progressPct = totalDays > 0 ? Math.min(100, (plantAgeDays / totalDays) * 100) : 0;

    if (!deviceId) {
        return (
            <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center text-slate-400">
                <Sprout className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Chọn thiết bị để xem thông tin vườn.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* === ACTIVE SEASON CARD === */}
            {seasonLoading ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                </div>
            ) : activeSeason ? (
                <>
                    {/* Hero Card */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/4 translate-x-1/4" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                        <span className="text-emerald-200 text-xs font-medium uppercase tracking-wider">Đang hoạt động</span>
                                    </div>
                                    <h2 className="text-2xl font-bold">{activeSeason.cropName}</h2>
                                    <p className="text-emerald-200 text-sm mt-0.5">trên {activeSeason.soilName}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${stageColors[currentStage]} bg-white/90`}>
                                    {stageLabels[currentStage]}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-emerald-200 mb-1.5">
                                    <span>Ngày {plantAgeDays}</span>
                                    <span>Tổng {totalDays} ngày</span>
                                </div>
                                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-700"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Key metrics */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
                                    <p className="text-emerald-200 text-[10px] uppercase tracking-wider mb-1">Ngày trồng</p>
                                    <p className="font-semibold text-sm">{format(parseDate(activeSeason.startDate), 'dd/MM/yyyy')}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
                                    <p className="text-emerald-200 text-[10px] uppercase tracking-wider mb-1">Kc hiện tại</p>
                                    <p className="font-semibold text-sm">{kcCurrent.toFixed(2)}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
                                    <p className="text-emerald-200 text-[10px] uppercase tracking-wider mb-1">Root Depth</p>
                                    <p className="font-semibold text-sm">{activeCrop?.maxRootDepth ?? '—'} m</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stage breakdown */}
                    {activeCrop && (
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2 text-sm">
                                <BarChart3 className="w-4 h-4 text-teal-500" />
                                Vòng đời cây trồng
                            </h3>
                            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
                                {[
                                    { label: 'Khởi đầu', days: activeCrop.stageIniDays, color: 'bg-sky-400', stage: 'initial' },
                                    { label: 'Phát triển', days: activeCrop.stageDevDays, color: 'bg-amber-400', stage: 'development' },
                                    { label: 'Giữa mùa', days: activeCrop.stageMidDays, color: 'bg-emerald-400', stage: 'mid' },
                                    { label: 'Cuối mùa', days: activeCrop.stageEndDays, color: 'bg-slate-400', stage: 'end' },
                                ].map(seg => (
                                    <div
                                        key={seg.stage}
                                        className={`h-full rounded-sm ${seg.color} transition-all ${currentStage === seg.stage ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-60'}`}
                                        style={{ width: `${(seg.days / totalDays) * 100}%` }}
                                        title={`${seg.label}: ${seg.days} ngày`}
                                    />
                                ))}
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    { label: 'Khởi đầu', days: activeCrop.stageIniDays, kc: activeCrop.kcIni, color: 'text-sky-600' },
                                    { label: 'Phát triển', days: activeCrop.stageDevDays, kc: (activeCrop.kcIni + activeCrop.kcMid) / 2, color: 'text-amber-600' },
                                    { label: 'Giữa mùa', days: activeCrop.stageMidDays, kc: activeCrop.kcMid, color: 'text-emerald-600' },
                                    { label: 'Cuối mùa', days: activeCrop.stageEndDays, kc: activeCrop.kcEnd, color: 'text-slate-500' },
                                ].map(seg => (
                                    <div key={seg.label} className="bg-slate-50 rounded-xl p-2">
                                        <p className={`text-xs font-semibold ${seg.color}`}>{seg.label}</p>
                                        <p className="text-slate-800 font-bold text-sm mt-0.5">{seg.days}d</p>
                                        <p className="text-slate-400 text-[10px]">Kc={seg.kc.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Soil info */}
                    {activeSoil && (
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2 text-sm">
                                <Layers className="w-4 h-4 text-amber-500" />
                                Thông tin đất: <span className="text-amber-600 font-bold ml-1">{activeSoil.name}</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <p className="text-[10px] text-blue-500 uppercase font-semibold mb-1">Field Capacity</p>
                                    <p className="text-xl font-bold text-blue-700">{activeSoil.fieldCapacity}%</p>
                                </div>
                                <div className="text-center p-3 bg-red-50 rounded-xl">
                                    <p className="text-[10px] text-red-500 uppercase font-semibold mb-1">Wilting Point</p>
                                    <p className="text-xl font-bold text-red-600">{activeSoil.wiltingPoint}%</p>
                                </div>
                                <div className="text-center p-3 bg-teal-50 rounded-xl">
                                    <p className="text-[10px] text-teal-500 uppercase font-semibold mb-1">Inf. Ratio</p>
                                    <p className="text-xl font-bold text-teal-700">
                                        {activeSoil.infiltrationShallowRatio != null
                                            ? `${(activeSoil.infiltrationShallowRatio * 100).toFixed(0)}%`
                                            : '70%'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700">
                                    TAW ≈ {((activeSoil.fieldCapacity - activeSoil.wiltingPoint) * 0.3 * 10).toFixed(0)} mm
                                    (dựa trên rễ 0.3m, p={activeCrop?.depletionFraction ?? 0.5}).
                                    Thông tin này được gửi tới AI Service khi dự báo tưới tiêu.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* End season */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                if (confirm('Bạn có chắc muốn kết thúc vụ mùa này?')) endSeasonMutation.mutate();
                            }}
                            disabled={endSeasonMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors"
                        >
                            {endSeasonMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Kết thúc vụ mùa
                        </button>
                    </div>
                </>
            ) : (
                /* === NO ACTIVE SEASON === */
                <div className="space-y-6">
                    {/* Recommendations */}
                    {recommendations.length > 0 && !showNewSeasonForm && (
                        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-100">
                            <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2 text-sm">
                                <Brain className="w-4 h-4" />
                                Gợi ý cây trồng theo thời tiết hiện tại
                            </h3>
                            <div className="space-y-2">
                                {recLoading
                                    ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
                                    : recommendations.slice(0, 3).map(rec => (
                                        <button
                                            key={rec.cropId}
                                            type="button"
                                            onClick={() => { setCropId(rec.cropId); setShowNewSeasonForm(true); }}
                                            className="w-full text-left p-3.5 rounded-xl bg-white border border-teal-200 hover:border-teal-400 hover:shadow-sm transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="font-semibold text-slate-800 group-hover:text-teal-700">{rec.cropName}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{rec.reason}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rec.matchScore > 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {Math.round(rec.matchScore * 100)}%
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500" />
                                            </div>
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Form hoặc Empty state */}
                    {!showNewSeasonForm ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Sprout className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Chưa có vụ mùa nào</h3>
                            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                                Bắt đầu một vụ mùa để AI có thể tính toán lượng nước bốc thoát hơi (ETc) và dự báo chính xác hơn.
                            </p>
                            <button
                                onClick={() => setShowNewSeasonForm(true)}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 shadow-sm shadow-emerald-500/20 transition-all"
                            >
                                <PlusIcon className="w-4 h-4" /> Bắt đầu vụ mùa mới
                            </button>
                        </div>
                    ) : (
                        /* NEW SEASON FORM */
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <Flower2 className="w-5 h-5 text-emerald-500" />
                                    Cấu hình vụ mùa mới
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Thông tin này giúp AI tính Kc, TAW, RAW để dự báo tưới tiêu chính xác.</p>
                            </div>
                            <div className="p-6 space-y-5">
                                {/* Crop select */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Leaf className="w-4 h-4 text-emerald-500" /> Loại cây trồng
                                    </label>
                                    {cropsLoading
                                        ? <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                                        : (
                                            <select
                                                value={cropId}
                                                onChange={e => setCropId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                            >
                                                <option value="">-- Chọn cây trồng --</option>
                                                {crops.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        )
                                    }
                                    {/* Preview crop info */}
                                    {selectedCrop && (
                                        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                                            {[
                                                { label: 'Kc_ini', val: selectedCrop.kcIni },
                                                { label: 'Kc_mid', val: selectedCrop.kcMid },
                                                { label: 'Kc_end', val: selectedCrop.kcEnd },
                                                { label: 'Root', val: `${selectedCrop.maxRootDepth}m` },
                                            ].map(item => (
                                                <div key={item.label} className="bg-teal-50 rounded-lg p-1.5">
                                                    <p className="text-[10px] text-teal-500 font-medium">{item.label}</p>
                                                    <p className="font-bold text-teal-800 text-xs">{item.val}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Soil select */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-amber-500" /> Loại đất
                                    </label>
                                    {soilsLoading
                                        ? <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                                        : (
                                            <select
                                                value={soilId}
                                                onChange={e => setSoilId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                            >
                                                <option value="">-- Chọn loại đất --</option>
                                                {soils.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} (FC: {s.fieldCapacity}% | WP: {s.wiltingPoint}%)
                                                    </option>
                                                ))}
                                            </select>
                                        )
                                    }
                                    {/* Preview soil info */}
                                    {soils.find(s => s.id === Number(soilId)) && (() => {
                                        const sel = soils.find(s => s.id === Number(soilId))!;
                                        const taw = ((sel.fieldCapacity - sel.wiltingPoint) * 0.003).toFixed(1);
                                        return (
                                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                                <div className="bg-blue-50 rounded-lg p-1.5">
                                                    <p className="text-[10px] text-blue-400 font-medium">Field Cap.</p>
                                                    <p className="font-bold text-blue-700 text-xs">{sel.fieldCapacity}%</p>
                                                </div>
                                                <div className="bg-red-50 rounded-lg p-1.5">
                                                    <p className="text-[10px] text-red-400 font-medium">Wilting Pt.</p>
                                                    <p className="font-bold text-red-600 text-xs">{sel.wiltingPoint}%</p>
                                                </div>
                                                <div className="bg-amber-50 rounded-lg p-1.5">
                                                    <p className="text-[10px] text-amber-400 font-medium">TAW (~0.3m)</p>
                                                    <p className="font-bold text-amber-700 text-xs">{taw} mm</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Start date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-500" /> Ngày bắt đầu trồng
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* Info box */}
                                <div className="flex items-start gap-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-indigo-700 leading-relaxed">
                                        Thông tin vụ mùa sẽ được gửi tới AI Service khi dự báo tưới tiêu. Hệ thống sẽ tự động tính <strong>giai đoạn sinh trưởng</strong>, <strong>hệ số cây trồng Kc</strong> và <strong>chiều sâu rễ</strong> để tối ưu lượng nước.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewSeasonForm(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!cropId || !soilId || !startDate) {
                                                toast.error('Vui lòng điền đầy đủ thông tin');
                                                return;
                                            }
                                            startSeasonMutation.mutate();
                                        }}
                                        disabled={!cropId || !soilId || startSeasonMutation.isPending}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium text-sm hover:from-teal-600 hover:to-emerald-600 shadow-sm shadow-emerald-500/20 disabled:opacity-60 transition-all"
                                    >
                                        {startSeasonMutation.isPending
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <CheckCircle2 className="w-4 h-4" />
                                        }
                                        {startSeasonMutation.isPending ? 'Đang lưu...' : 'Bắt đầu vụ mùa'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// IRRIGATION CONFIG TAB (extracted)
// ============================================================
const IrrigationSettingsTab: React.FC<{
    config: IrrigationConfig;
    onConfigChange: (u: Partial<IrrigationConfig>) => void;
    onSave: () => void;
    isSaving: boolean;
    saved: boolean;
    deviceId: number | null;
}> = ({ config, onConfigChange, onSave, isSaving, saved, deviceId }) => {
    const handleSliderChange = (field: 'soilMoistureMin' | 'soilMoistureMax', value: number) => {
        if (field === 'soilMoistureMin' && value >= config.soilMoistureMax) return;
        if (field === 'soilMoistureMax' && value <= config.soilMoistureMin) return;
        onConfigChange({ [field]: value });
    };
    const handleDurationChange = (delta: number) => {
        const next = Math.max(5, Math.min(600, config.wateringDuration + delta));
        onConfigChange({ wateringDuration: next });
    };

    const SwitchRow: React.FC<{
        label: string; desc: string; checked: boolean;
        onChange: (v: boolean) => void; icon: React.ReactNode; color: string;
    }> = ({ label, desc, checked, onChange, icon, color }) => (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
                <div>
                    <p className="font-medium text-slate-700 text-sm">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                </div>
            </div>
            <Switch.Root
                checked={checked}
                onCheckedChange={onChange}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-teal-500' : 'bg-slate-200'}`}
            >
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Mode Switches */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-teal-500" /> Chế độ hoạt động
                </h2>
                <div className="space-y-3">
                    <SwitchRow
                        label="Chế độ tự động"
                        desc="Tự động tưới khi độ ẩm thấp hơn ngưỡng"
                        checked={config.autoMode}
                        onChange={v => onConfigChange({ autoMode: v })}
                        icon={<Zap className="w-4 h-4" />}
                        color="bg-teal-50 text-teal-500"
                    />
                    <SwitchRow
                        label="Fuzzy Logic"
                        desc="Sử dụng logic mờ để tối ưu lượng nước"
                        checked={config.fuzzyEnabled}
                        onChange={v => onConfigChange({ fuzzyEnabled: v })}
                        icon={<Gauge className="w-4 h-4" />}
                        color="bg-purple-50 text-purple-500"
                    />
                    <SwitchRow
                        label="Dự báo ML/AI"
                        desc="Sử dụng Machine Learning để tối ưu nước"
                        checked={config.aiEnabled}
                        onChange={v => onConfigChange({ aiEnabled: v })}
                        icon={<Brain className="w-4 h-4" />}
                        color="bg-indigo-50 text-indigo-500"
                    />
                </div>
            </div>

            {/* Thresholds */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" /> Ngưỡng độ ẩm đất
                </h2>
                <div className="space-y-6">
                    {[
                        { field: 'soilMoistureMin' as const, label: 'Ngưỡng tối thiểu', desc: 'Bắt đầu tưới khi ẩm đất thấp hơn', value: config.soilMoistureMin, color: 'text-red-500', accent: 'accent-red-500', grad: 'from-red-200 to-red-400' },
                        { field: 'soilMoistureMax' as const, label: 'Ngưỡng tối đa', desc: 'Ngừng tưới khi ẩm đất cao hơn', value: config.soilMoistureMax, color: 'text-blue-500', accent: 'accent-blue-500', grad: 'from-blue-200 to-blue-400' },
                    ].map(item => (
                        <div key={item.field}>
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="font-medium text-slate-700 text-sm">{item.label}</p>
                                    <p className="text-xs text-slate-400">{item.desc}</p>
                                </div>
                                <span className={`text-2xl font-bold ${item.color}`}>{item.value}%</span>
                            </div>
                            <input
                                type="range" min={10} max={90} value={item.value}
                                onChange={e => handleSliderChange(item.field, Number(e.target.value))}
                                className={`w-full h-2 bg-gradient-to-r ${item.grad} rounded-full appearance-none cursor-pointer ${item.accent}`}
                            />
                        </div>
                    ))}

                    <div className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 mb-2">Phạm vi hoạt động</p>
                        <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="absolute h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                                style={{ left: `${config.soilMoistureMin}%`, width: `${config.soilMoistureMax - config.soilMoistureMin}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                            <span className="text-red-500 font-medium">{config.soilMoistureMin}% (Khô)</span>
                            <span className="text-blue-500 font-medium">{config.soilMoistureMax}% (Ẩm)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Duration */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
                    <Power className="w-4 h-4 text-emerald-500" /> Thời gian tưới
                </h2>
                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => handleDurationChange(-5)} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-[100px]">
                        <span className="text-4xl font-bold text-slate-800">{config.wateringDuration}</span>
                        <p className="text-sm text-slate-400 mt-1">giây / lần tưới</p>
                    </div>
                    <button onClick={() => handleDurationChange(5)} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-3">
                    {Math.floor(config.wateringDuration / 60)} phút {config.wateringDuration % 60} giây
                </p>
            </div>

            <button
                onClick={onSave}
                disabled={!deviceId || isSaving}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${saved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600 shadow-sm disabled:opacity-50'
                    }`}
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Đã lưu' : 'Lưu cấu hình tưới'}
            </button>
        </div>
    );
};

// ============================================================
// SENSOR + MANUAL TAB
// ============================================================
const SensorManualTab: React.FC<{ deviceId: number | null; config: IrrigationConfig }> = ({ deviceId, config }) => {
    const [isIrrigating, setIsIrrigating] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const { data: sensorRes } = useQuery({
        queryKey: ['sensorLatest', deviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(deviceId!),
        enabled: !!deviceId,
        refetchInterval: 30000,
    });

    const s = sensorRes
        ? { soilMoisture: sensorRes.soilMoisture ?? 0, temperature: sensorRes.temperature ?? 0, humidity: sensorRes.humidity ?? 0, lightIntensity: sensorRes.lightIntensity ?? 0 }
        : { soilMoisture: 0, temperature: 0, humidity: 0, lightIntensity: 0 };

    const handleManualIrrigation = async () => {
        setShowConfirm(false);
        setIsIrrigating(true);
        await new Promise(r => setTimeout(r, 3000));
        setIsIrrigating(false);
    };

    const sensorItems = [
        { icon: <Droplets className="w-4 h-4 text-blue-500" />, label: 'Độ ẩm đất', value: `${s.soilMoisture}%`, bg: 'bg-blue-50/60', highlight: s.soilMoisture < config.soilMoistureMin ? 'text-red-500' : s.soilMoisture > config.soilMoistureMax ? 'text-blue-600' : 'text-emerald-600' },
        { icon: <Thermometer className="w-4 h-4 text-orange-500" />, label: 'Nhiệt độ', value: `${s.temperature}°C`, bg: 'bg-orange-50/60', highlight: 'text-slate-800' },
        { icon: <Wind className="w-4 h-4 text-cyan-500" />, label: 'Độ ẩm KK', value: `${s.humidity}%`, bg: 'bg-cyan-50/60', highlight: 'text-slate-800' },
        { icon: <Sun className="w-4 h-4 text-yellow-500" />, label: 'Ánh sáng', value: `${s.lightIntensity.toLocaleString()} lux`, bg: 'bg-yellow-50/60', highlight: 'text-slate-800' },
    ];

    return (
        <div className="space-y-6">
            {/* Sensor readings */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-teal-500" /> Cảm biến hiện tại</span>
                    <span className="text-xs text-slate-400">Tự động cập nhật 30s</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    {sensorItems.map(item => (
                        <div key={item.label} className={`flex items-center justify-between p-3.5 rounded-xl ${item.bg}`}>
                            <div className="flex items-center gap-2">
                                {item.icon}
                                <span className="text-sm text-slate-600">{item.label}</span>
                            </div>
                            <span className={`font-bold text-sm ${item.highlight}`}>{item.value}</span>
                        </div>
                    ))}
                </div>
                {s.soilMoisture < config.soilMoistureMin && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        Độ ẩm đất đang dưới ngưỡng tối thiểu ({config.soilMoistureMin}%)!
                    </div>
                )}
            </div>

            {/* Manual irrigation */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Power className="w-4 h-4 text-blue-500" /> Tưới thủ công
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Kích hoạt máy bơm ngay lập tức trong <span className="font-semibold text-slate-700">{config.wateringDuration} giây</span>.
                </p>
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={isIrrigating || !deviceId}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all text-sm ${isIrrigating
                        ? 'bg-blue-100 text-blue-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm disabled:opacity-40'
                        }`}
                >
                    {isIrrigating ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang tưới...</> : <><Power className="w-5 h-5" /> Bắt đầu tưới</>}
                </button>
                {isIrrigating && (
                    <div className="mt-3">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full w-3/5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-center">Máy bơm đang hoạt động</p>
                    </div>
                )}
            </div>

            {/* Confirm dialog */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <div className="mx-auto w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                            <Power className="w-7 h-7 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Xác nhận tưới thủ công</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Máy bơm sẽ hoạt động trong <strong>{config.wateringDuration} giây</strong>. Bạn có chắc chắn?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                                Huỷ
                            </button>
                            <button onClick={handleManualIrrigation} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-cyan-600">
                                Bắt đầu tưới
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN PAGE
// ============================================================
export const IrrigationConfigPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [deviceId, setDeviceId] = useState<number | null>(null);
    const [config, setConfig] = useState<IrrigationConfig>(fallbackConfig);
    const [saved, setSaved] = useState(false);

    const { data: devices = [] } = useQuery({ queryKey: ['myDevices'], queryFn: deviceApi.getMyDevices });
    const { data: configRes } = useQuery({
        queryKey: ['irrigationConfig', deviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    useEffect(() => { if (devices.length > 0 && deviceId === null) setDeviceId(devices[0].id); }, [devices, deviceId]);
    useEffect(() => {
        if (configRes) {
            setConfig({
                id: configRes.id, deviceId: configRes.deviceId,
                autoMode: configRes.autoMode ?? false,
                fuzzyEnabled: configRes.fuzzyEnabled ?? false,
                aiEnabled: configRes.aiEnabled ?? false,
                soilMoistureMin: configRes.soilMoistureMin ?? 30,
                soilMoistureMax: configRes.soilMoistureMax ?? 70,
                wateringDuration: configRes.irrigationDurationMax ?? configRes.irrigationDurationMin ?? 30,
            });
        }
    }, [configRes]);

    const saveMutation = useMutation({
        mutationFn: () => irrigationApi.userUpdateConfig(deviceId!, {
            soilMoistureMin: config.soilMoistureMin, soilMoistureMax: config.soilMoistureMax,
            irrigationDurationMin: config.wateringDuration, irrigationDurationMax: config.wateringDuration,
            autoMode: config.autoMode, fuzzyEnabled: config.fuzzyEnabled, aiEnabled: config.aiEnabled,
        }),
        onSuccess: () => {
            setSaved(true);
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] });
            setTimeout(() => setSaved(false), 2000);
            toast.success('Cấu hình đã được lưu!');
        },
        onError: () => toast.error('Không thể lưu cấu hình, vui lòng thử lại.'),
    });

    const currentDevice = devices.find(d => d.id === deviceId);
    const tabClass = "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cấu hình hệ thống</h1>
                    <p className="text-slate-500 mt-1 text-sm">Quản lý vụ mùa, loại đất, chế độ tưới tự động và cảm biến</p>
                </div>
                {devices.length > 0 && (
                    <div className="flex items-center gap-3">
                        <select
                            value={deviceId ?? ''}
                            onChange={e => setDeviceId(Number(e.target.value))}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                        >
                            {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.deviceName} ({d.deviceCode})</option>
                            ))}
                        </select>
                        {currentDevice && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-medium text-emerald-700">Online</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs.Root defaultValue="garden">
                <Tabs.List className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                    <Tabs.Trigger value="garden" className={tabClass}>
                        <Sprout className="w-4 h-4" /> Vườn của tôi
                    </Tabs.Trigger>
                    <Tabs.Trigger value="config" className={tabClass}>
                        <Settings2 className="w-4 h-4" /> Cấu hình tưới
                    </Tabs.Trigger>
                    <Tabs.Trigger value="sensor" className={tabClass}>
                        <FlaskConical className="w-4 h-4" /> Cảm biến & Điều khiển
                    </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="garden" className="mt-6">
                    <GardenProfileTab deviceId={deviceId} />
                </Tabs.Content>

                <Tabs.Content value="config" className="mt-6">
                    <IrrigationSettingsTab
                        config={config}
                        onConfigChange={u => { setConfig(p => ({ ...p, ...u })); setSaved(false); }}
                        onSave={() => { if (deviceId) saveMutation.mutate(); }}
                        isSaving={saveMutation.isPending}
                        saved={saved}
                        deviceId={deviceId}
                    />
                </Tabs.Content>

                <Tabs.Content value="sensor" className="mt-6">
                    <SensorManualTab deviceId={deviceId} config={config} />
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};
