import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sprout, Loader2, Calendar, MapPin, X, Leaf, Plus, Brain } from 'lucide-react';
import { cropSeasonApi, type CropSeasonCreateRequest } from '../api/cropSeason';
import { cropApi } from '../api/crop';
import { soilApi } from '../api/soil';
import { format, differenceInDays } from 'date-fns';

const parseDate = (dateVal: string | number[] | undefined): Date => {
    if (!dateVal) return new Date();
    if (Array.isArray(dateVal)) {
        return new Date(dateVal[0], dateVal[1] - 1, dateVal[2]);
    }
    return new Date(dateVal);
};

interface CropSeasonManagerProps {
    deviceId: number;
}

export const CropSeasonManager: React.FC<CropSeasonManagerProps> = ({ deviceId }) => {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [cropId, setCropId] = useState<number | ''>('');
    const [soilId, setSoilId] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [showRecommendations, setShowRecommendations] = useState(false);

    // Fetch data
    const { data: activeSeason, isLoading: seasonLoading } = useQuery({
        queryKey: ['activeSeason', deviceId],
        queryFn: () => cropSeasonApi.getActiveSeason(deviceId),
        enabled: !!deviceId,
    });

    const { data: crops = [] } = useQuery({
        queryKey: ['crops'],
        queryFn: cropApi.getAllCropLibraries,
    });

    const { data: soils = [] } = useQuery({
        queryKey: ['soils'],
        queryFn: soilApi.getAllSoilLibraries,
    });

    const { data: recommendations = [], isLoading: recLoading } = useQuery({
        queryKey: ['cropRecommendations', deviceId],
        queryFn: () => cropSeasonApi.getRecommendations(deviceId),
        enabled: !!deviceId && showRecommendations,
    });

    const startSeasonMutation = useMutation({
        mutationFn: (request: CropSeasonCreateRequest) => cropSeasonApi.startNewSeason(deviceId, request),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSeason', deviceId] });
            setShowModal(false);
            setCropId('');
            setSoilId('');
        }
    });

    const endSeasonMutation = useMutation({
        mutationFn: () => cropSeasonApi.endActiveSeason(deviceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSeason', deviceId] });
        }
    });

    const handleStartSeason = (e: React.FormEvent) => {
        e.preventDefault();
        if (!cropId || !soilId || !startDate) return;
        startSeasonMutation.mutate({
            cropId: Number(cropId),
            soilId: Number(soilId),
            startDate
        });
    };

    if (seasonLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                        <Sprout className="w-5 h-5 text-emerald-500" />
                        Quản lý vụ mùa
                    </h2>
                    {activeSeason && (
                        <button
                            onClick={() => endSeasonMutation.mutate()}
                            disabled={endSeasonMutation.isPending}
                            className="text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            {endSeasonMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Kết thúc vụ này
                        </button>
                    )}
                </div>

                {activeSeason ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-emerald-900 text-lg">{activeSeason.cropName}</h3>
                                    <p className="text-sm text-emerald-700 mt-1">
                                        Đang trồng trên <span className="font-medium">{activeSeason.soilName}</span>
                                    </p>
                                </div>
                                <div className="px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full shadow-sm">
                                    Đang phát triển
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-emerald-200/60 pt-4">
                                <div>
                                    <p className="text-xs text-emerald-600/70 mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Ngày trồng
                                    </p>
                                    <p className="font-medium text-emerald-800 text-sm">
                                        {format(parseDate(activeSeason.startDate), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-emerald-600/70 mb-1 flex items-center gap-1">
                                        <Leaf className="w-3 h-3" /> Số ngày
                                    </p>
                                    <p className="font-medium text-emerald-800 text-sm">
                                        {differenceInDays(new Date(), parseDate(activeSeason.startDate))} ngày
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                            Thông tin vụ mùa giúp AI Service tính toán lượng nước tiêu thụ bốc thoát hơi (ETc) chính xác hơn.
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3 group-hover:text-teal-400 transition-colors" />
                        <h3 className="font-medium text-slate-700 mb-1">Chưa có vụ mùa nào</h3>
                        <p className="text-sm text-slate-500 mb-4 max-w-[250px] mx-auto">
                            Bắt đầu một vụ mùa mới để AI Service có thể dự báo tưới tiêu chính xác hơn.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:from-teal-600 hover:to-emerald-600 shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" /> Bắt đầu vụ mới
                        </button>
                    </div>
                )}
            </div>

            {/* Start Season Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Sprout className="w-5 h-5 text-emerald-500" />
                                Bắt đầu vụ mùa mới
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <form id="season-form" onSubmit={handleStartSeason} className="space-y-5">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-slate-700">Loại cây trồng</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowRecommendations(!showRecommendations)}
                                            className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        >
                                            <MapPin className="w-3 h-3" /> {showRecommendations ? 'Ẩn gợi ý' : 'Gợi ý theo thời tiết'}
                                        </button>
                                    </div>
                                    <select
                                        value={cropId}
                                        onChange={(e) => setCropId(e.target.value ? Number(e.target.value) : '')}
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">-- Chọn cây trồng --</option>
                                        {crops.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Intelligent Recommendations */}
                                {showRecommendations && (
                                    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100">
                                        <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-800 uppercase mb-3">
                                            <Brain className="w-3.5 h-3.5" /> Gợi ý từ AI
                                            {recLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                                        </h4>
                                        <div className="space-y-2">
                                            {recommendations.slice(0, 3).map((rec) => (
                                                <button
                                                    key={rec.cropId}
                                                    type="button"
                                                    onClick={() => setCropId(rec.cropId)}
                                                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all flex items-start flex-col gap-1
                                                        ${cropId === rec.cropId ? 'bg-white border-teal-400 shadow-sm ring-1 ring-teal-400' : 'bg-white/50 border-teal-200/60 hover:bg-white hover:border-teal-300'}`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-semibold text-teal-900">{rec.cropName}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rec.matchScore > 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {Math.round(rec.matchScore * 100)}% Phù hợp
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-teal-700/80 leading-relaxed">{rec.reason}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Loại đất</label>
                                    <select
                                        value={soilId}
                                        onChange={(e) => setSoilId(e.target.value ? Number(e.target.value) : '')}
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">-- Chọn loại đất --</option>
                                        {soils.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name} (Ẩm độ: {s.wiltingPoint}% - {s.fieldCapacity}%)</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày bắt đầu mô phỏng</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                form="season-form"
                                disabled={startSeasonMutation.isPending || !cropId || !soilId}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium text-sm hover:from-teal-600 hover:to-emerald-600 flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 disabled:opacity-60 transition-all"
                            >
                                {startSeasonMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bắt đầu ngay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
