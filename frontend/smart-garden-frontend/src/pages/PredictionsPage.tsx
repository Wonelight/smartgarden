import React, { useState, useEffect } from 'react';
import {
    Brain, Zap, TrendingUp, BarChart3, Droplets,
    Target, Activity, Gauge, CloudRain, Sun, Wind, X
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Line, Area, AreaChart,
    ComposedChart,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi, type UserDeviceListItem } from '../api/device';
import { waterBalanceApi } from '../api/waterBalance';
import { aiApi, type MlPredictionDetailResponse } from '../api/ai';
import { sensorApi } from '../api/sensor';
import { irrigationApi } from '../api/irrigation';
import { toast } from 'sonner';
import { SkeletonCard, SkeletonStatsGrid, SkeletonChart, SkeletonTable } from '../components/ui/Skeleton';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/Tooltip';
import { useMonitoringDevice } from '../contexts/MonitoringDeviceContext';
import { getApiErrorMessage } from '../utils/apiError';

// ============================================
// DECISION BADGE CONFIG
// ============================================

const decisionConfig = {
    NO_IRRIGATION: { label: 'Không tưới', color: 'bg-slate-100 text-slate-600' },
    LOW: { label: 'Ít', color: 'bg-blue-50 text-blue-600' },
    MEDIUM: { label: 'Vừa', color: 'bg-yellow-50 text-yellow-700' },
    HIGH: { label: 'Nhiều', color: 'bg-red-50 text-red-600' },
};

// ============================================
// ML PREDICTIONS TAB (real AI service)
// ============================================

const MLPredictionsTab: React.FC<{ selectedDeviceId: number | null, isOffline?: boolean }> = ({ selectedDeviceId, isOffline = false }) => {
    const queryClient = useQueryClient();
    const [selectedPrediction, setSelectedPrediction] = useState<MlPredictionDetailResponse | null>(null);

    const { data: historyResults, isLoading: loadingHistory, error: errorHistory } = useQuery({
        queryKey: ['aiHistory', selectedDeviceId],
        queryFn: () => aiApi.getHistory(selectedDeviceId!),
        enabled: !!selectedDeviceId,
        retry: false,
    });

    useEffect(() => {
        if (errorHistory) {
            // Only show toast if it's not a 404 (404 is handled in UI with a friendly message)
            const status = (errorHistory as any)?.response?.status;
            if (status !== 404) {
                toast.error(getApiErrorMessage(errorHistory));
            } else {
                // For 404, check if it's a specific "no crop season" error
                const errorMessage = getApiErrorMessage(errorHistory);
                if (errorMessage.includes('Không có mùa vụ nào đang hoạt động cho thiết bị này.')) {
                    // Handle this specific 404 message differently if needed, or just let it pass
                    // For now, we'll just not show a toast for this specific 404, as the UI handles it.
                } else {
                    toast.error(errorMessage);
                }
            }
        }
    }, [errorHistory]);

    const { data: latestSensor, isLoading: loadingSensor, error: errorSensor } = useQuery({
        queryKey: ['sensorLatest', selectedDeviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(selectedDeviceId!),
        enabled: !!selectedDeviceId,
        retry: false,
    });

    const { data: config, isLoading: loadingConfig } = useQuery({
        queryKey: ['irrigationConfig', selectedDeviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(selectedDeviceId!),
        enabled: !!selectedDeviceId,
        retry: false,
    });

    const predictMutation = useMutation({
        mutationFn: (payload: { deviceId: number; sensorDataId: number }) => aiApi.predict(payload),
        onSuccess: () => {
            toast.success('Đã gọi dự báo AI thành công.');
            queryClient.invalidateQueries({ queryKey: ['aiHistory', selectedDeviceId] });
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err));
        },
    });

    const enableAiMutation = useMutation({
        mutationFn: () => irrigationApi.userUpdateConfig(selectedDeviceId!, { aiEnabled: true }),
        onSuccess: () => {
            toast.success('Đã bật tính năng AI.');
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', selectedDeviceId] });
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err));
        }
    });

    const latestResult = historyResults && historyResults.length > 0 ? historyResults[0] : null;
    const confidence = latestResult?.modelAccuracy ?? latestResult?.aiAccuracy ?? 0;

    // Prepare chart data from history (reverse to show oldest to newest left to right)
    const chartData = historyResults
        ? [...historyResults].reverse().map(result => {
            const resultConfidence = result.modelAccuracy ?? result.aiAccuracy ?? 0;
            return {
                time: new Date(result.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                waterAmount: result.predictedWaterAmount ?? 0,
                confidence: Math.round(resultConfidence * 100),
            };
        })
        : [];

    const modelVersion = (latestResult?.aiParams as Record<string, unknown> | undefined)?.model as string ?? '—';

    // Helper to format AI params
    const formatAiParams = (params: Record<string, unknown> | null) => {
        if (!params) return null;
        const features = params.features as Record<string, number | string> | undefined;
        const allFeatures = features ?? {};
        return {
            model: params.model ?? '—',
            version: params.version ?? '—',
            etc: features?.etc ?? '—',
            soilMoistDeficit: features?.soil_moist_deficit ?? '—',
            predictedDepl24h: features?.predicted_depl_24h ?? '—',
            raw: features?.raw ?? '—',
            shallow: features?.soil_moist_shallow ?? '—',
            deep: features?.soil_moist_deep ?? '—',
            waterMm: features?.water_mm ?? '—',
            soilTrend1h: features?.soil_moist_trend_1h ?? '—',
            allFeatures,
        };
    };

    if (!selectedDeviceId) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-slate-500">
                Chọn thiết bị ở tab &quot;FAO-56 Water Balance&quot; hoặc danh sách bên trên để xem dự báo ML.
            </div>
        );
    }

    const hasSensorData = !!latestSensor && !errorSensor;
    const noSensorData = selectedDeviceId && !loadingSensor && (!!errorSensor || !latestSensor);
    const isAiEnabled = config?.aiEnabled === true;

    if (!isAiEnabled && !loadingConfig) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center text-amber-700">
                <Brain className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Tính năng AI chưa được bật</h3>
                <p className="text-sm mb-4">
                    Thiết bị này hiện chưa bật tính năng Dự báo AI (Machine Learning).
                    Bật tính năng này để hệ thống có thể dự báo lượng nước tự động.
                </p>
                <button
                    onClick={() => enableAiMutation.mutate()}
                    disabled={enableAiMutation.isPending || isOffline}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                    {enableAiMutation.isPending ? 'Đang bật...' : 'Bật tính năng AI ngay'}
                </button>
            </div>
        );
    }

    if (errorHistory && (errorHistory as { response?: { status?: number } })?.response?.status === 404) {
        return (
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    Chưa có dự báo nào cho thiết bị này. Nhấn &quot;Gọi dự báo AI&quot; để tạo dự báo từ AI service.
                </div>
                {loadingSensor && (
                    <p className="text-sm text-slate-500">Đang tải dữ liệu sensor...</p>
                )}
                {noSensorData && !loadingSensor && (
                    <p className="text-sm text-slate-600">
                        Chưa có dữ liệu sensor. Đảm bảo thiết bị đã gửi dữ liệu cảm biến trước khi gọi dự báo.
                    </p>
                )}
                {hasSensorData && (
                    <button
                        onClick={() => {
                            if (isOffline) {
                                toast.error('Thiết bị đang offline, không thể gọi dự báo AI thủ công.');
                                return;
                            }
                            predictMutation.mutate({ deviceId: selectedDeviceId, sensorDataId: latestSensor.id });
                        }}
                        disabled={predictMutation.isPending || isOffline}
                        className={`px-4 py-2 text-white rounded-xl font-medium transition-colors ${isOffline ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600 disabled:opacity-50'}`}
                    >
                        {predictMutation.isPending ? 'Đang gọi...' : 'Gọi dự báo AI'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-orange-50 text-orange-600"><Target className="w-5 h-5" /></div>
                        <span className="text-sm text-slate-500">Độ tin cậy (Mới nhất)</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{loadingHistory ? '—' : Math.round(confidence * 100)}</span>
                        <span className="text-sm text-slate-400">%</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><Droplets className="w-5 h-5" /></div>
                        <span className="text-sm text-slate-500">Lượng nước (Mới nhất)</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{loadingHistory ? '—' : (latestResult?.predictedWaterAmount ?? 0).toFixed(1)}</span>
                        <span className="text-sm text-slate-400">mm</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><Brain className="w-5 h-5" /></div>
                        <span className="text-sm text-slate-500">Model</span>
                    </div>
                    <span className="text-lg font-bold text-slate-800 font-mono">{loadingHistory ? '—' : modelVersion}</span>
                </div>
            </div>

            {loadingSensor && (
                <p className="text-sm text-slate-500">Đang tải dữ liệu sensor...</p>
            )}
            {noSensorData && !loadingSensor && (
                <p className="text-sm text-slate-600">
                    Chưa có dữ liệu sensor. Đảm bảo thiết bị đã gửi dữ liệu cảm biến trước khi gọi dự báo.
                </p>
            )}
            {hasSensorData && (
                <button
                    onClick={() => {
                        if (isOffline) {
                            toast.error('Thiết bị đang offline, không thể gọi dự báo AI thủ công.');
                            return;
                        }
                        predictMutation.mutate({ deviceId: selectedDeviceId, sensorDataId: latestSensor!.id });
                    }}
                    disabled={predictMutation.isPending || isOffline}
                    className={`px-4 py-2 text-white rounded-xl font-medium transition-colors ${isOffline ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600 disabled:opacity-50'}`}
                >
                    {predictMutation.isPending ? 'Đang gọi...' : 'Gọi dự báo AI (mới nhất)'}
                </button>
            )}

            {chartData.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-500" />
                        Xu hướng dự báo lượng nước
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px' }} />
                            <Area type="monotone" dataKey="waterAmount" stroke="#14b8a6" strokeWidth={2} fill="url(#waterGrad)" name="Lượng nước (mm)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {historyResults && historyResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Thời gian</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Lượng nước</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Độ tin cậy</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Loại</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Thời gian tưới (s)</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historyResults.map((result) => {
                                    const resConf = result.modelAccuracy ?? result.aiAccuracy ?? 0;
                                    return (
                                        <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{new Date(result.createdAt).toLocaleString('vi-VN')}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{result.predictedWaterAmount ?? 0} mm</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round(resConf * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600">{Math.round(resConf * 100)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">{result.predictionType ?? 'WATER_NEED'}</span></td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{result.predictedDuration ?? '—'} s</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedPrediction(result)}
                                                    className="text-teal-600 hover:text-teal-700 font-medium text-xs bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Chi tiết AI Params */}
            {selectedPrediction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedPrediction(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-teal-600" />
                                    Chi tiết thông số AI
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Dự báo lúc {new Date(selectedPrediction.createdAt).toLocaleString('vi-VN')}</p>
                            </div>
                            <button onClick={() => setSelectedPrediction(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {(() => {
                                const details = formatAiParams(selectedPrediction.aiParams as Record<string, unknown> | null);
                                if (!details) return <p className="text-sm text-slate-500">Không có dữ liệu chi tiết JSON params.</p>;

                                return (
                                    <>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Thông tin Model</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-xs text-slate-500">Tên Model</p>
                                                    <p className="font-medium text-slate-800">{String(details.model)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Phiên bản</p>
                                                    <p className="font-medium text-slate-800">{String(details.version)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Chỉ số Nông học (FAO-56)</h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="text-sm text-slate-600 border-b border-dashed border-slate-300 cursor-help">ETc (Bốc hơi nước)</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p>Lượng nước bốc thoát hơi tiềm năng của cây trồng.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <span className="font-medium text-slate-800">{String(details.etc)} mm</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="text-sm text-slate-600 border-b border-dashed border-slate-300 cursor-help">Predicted Depl 24h</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p>Dự báo mức thâm hụt nước sau 24h tới.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <span className="font-medium text-blue-600">{String(details.predictedDepl24h)} mm</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="text-sm text-slate-600 border-b border-dashed border-slate-300 cursor-help">Soil Moist Deficit</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p>Độ thâm hụt độ ẩm đất hiện tại so với mức bão hòa.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <span className={`font-medium ${typeof details.soilMoistDeficit === 'number' && details.soilMoistDeficit < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                                                        {String(details.soilMoistDeficit)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-600">RAW (Readily Avail.)</span>
                                                    <span className="font-medium text-slate-800">{details.raw} mm</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-600">Độ ẩm đất nông (Shallow)</span>
                                                    <span className="font-medium text-slate-800">{details.shallow}%</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-600">Độ ẩm đất sâu (Deep)</span>
                                                    <span className="font-medium text-slate-800">{details.deep}%</span>
                                                </div>
                                                {/* Extra features - dynamic */}
                                                {details.allFeatures && Object.entries(details.allFeatures)
                                                    .filter(([k]) => !['etc', 'soil_moist_deficit', 'predicted_depl_24h', 'raw',
                                                        'soil_moist_shallow', 'soil_moist_deep', 'water_mm', 'soil_moist_trend_1h'].includes(k))
                                                    .map(([key, val]) => (
                                                        <div key={key} className="flex justify-between items-center py-2 border-b border-slate-50">
                                                            <span className="text-sm text-slate-600 font-mono text-xs">{key}</span>
                                                            <span className="font-medium text-slate-700">{String(val)}</span>
                                                        </div>
                                                    ))}
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-sm text-slate-600">Xu hướng độ ẩm 1h</span>
                                                    <span className="font-medium text-slate-800">{details.soilTrend1h}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-sm font-semibold text-teal-600">Lượng nước đầu ra (AI Output)</span>
                                                    <span className="font-bold text-teal-600">{details.waterMm} mm</span>
                                                </div>                                   </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setSelectedPrediction(null)} className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// FUZZY LOGIC TAB
// ============================================

const FuzzyLogicTab: React.FC = () => {
    const [selectedResult, setSelectedResult] = useState(0);
    const current = mockFuzzyResults[selectedResult];

    // Membership values for radar chart
    const radarData = Object.entries(current.membershipValues).map(([key, value]) => ({
        subject: key,
        value: Math.round(value * 100),
        fullMark: 100,
    }));

    // Distribution of decisions
    const decisionCounts = mockFuzzyResults.reduce((acc, r) => {
        acc[r.irrigationDecision] = (acc[r.irrigationDecision] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const decisionChartData = Object.entries(decisionCounts).map(([key, count]) => ({
        decision: decisionConfig[key as keyof typeof decisionConfig].label,
        count,
    }));

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">Tổng đánh giá</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{mockFuzzyResults.length}</span>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                            <Droplets className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">TB lượng nước</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">
                            {(mockFuzzyResults.reduce((s, r) => s + r.waterAmount, 0) / mockFuzzyResults.length).toFixed(1)}
                        </span>
                        <span className="text-sm text-slate-400">lít</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-red-50 text-red-600">
                            <Zap className="w-5 h-5" />
                        </div>
                        <span className="text-sm text-slate-500">Cần tưới nhiều</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-800">
                        {mockFuzzyResults.filter((r) => r.irrigationDecision === 'HIGH').length}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Decision Distribution */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-teal-500" />
                        Phân bố quyết định tưới
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={decisionChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="decision" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px' }} />
                            <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Số lần" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Membership Radar */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        Membership Values
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">
                        {new Date(current.timestamp).toLocaleString('vi-VN')}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Radar name="Giá trị" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                        </RadarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {mockFuzzyResults.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedResult(i)}
                                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${i === selectedResult
                                    ? 'bg-purple-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fuzzy Results Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Thời gian</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ẩm đất</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nhiệt độ</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ẩm KK</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ánh sáng</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Quyết định</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Lượng nước</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {mockFuzzyResults.map((r) => {
                                const dec = decisionConfig[r.irrigationDecision];
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                            {new Date(r.timestamp).toLocaleString('vi-VN', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">{r.soilMoisture}%</td>
                                        <td className="px-4 py-3 text-slate-600">{r.temperature}°C</td>
                                        <td className="px-4 py-3 text-slate-600">{r.humidity}%</td>
                                        <td className="px-4 py-3 text-slate-600">{r.lightIntensity.toLocaleString()} lux</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${dec.color}`}>
                                                {dec.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{r.waterAmount} L</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ============================================
// WATER BALANCE MONITORING TAB
// ============================================

const WaterBalanceMonitoringTab: React.FC<{
    selectedDeviceId: number | null;
    devices: UserDeviceListItem[];
    devicesLoading: boolean;
}> = ({ selectedDeviceId, devices, devicesLoading }) => {
    const { data: waterBalanceState, isLoading: wbLoading, error: wbError } = useQuery({
        queryKey: ['waterBalanceState', selectedDeviceId],
        queryFn: () => waterBalanceApi.getWaterBalanceState(selectedDeviceId!),
        enabled: selectedDeviceId !== null,
        retry: false,
    });

    useEffect(() => {
        if (wbError) {
            toast.error(getApiErrorMessage(wbError));
        }
    }, [wbError]);

    if (devicesLoading) {
        return (
            <div className="space-y-6">
                <SkeletonCard />
                <SkeletonStatsGrid count={4} />
                <SkeletonChart height={300} />
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500">
                Không có thiết bị nào. Vui lòng thêm thiết bị để xem dữ liệu water balance.
            </div>
        );
    }

    const currentDevice = devices.find(d => d.id === selectedDeviceId);
    const wb = waterBalanceState;

    // Guard: tránh NaN/Infinity khi chia cho 0
    const safeDiv = (a: number, b: number, fallback = 0) => (b > 0 ? a / b : fallback);

    // Chart data for depletion over time
    const depletionChartData = wb?.soilMoisHistory
        ? wb.soilMoisHistory.slice(-7).map((entry: any, idx: number) => ({
            time: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : `Day ${idx + 1}`,
            shallow: entry.shallowDepletion || 0,
            deep: entry.deepDepletion || 0,
            weighted: entry.weightedDepletion || 0,
        }))
        : [];

    return (
        <div className="space-y-6">
            {/* Device Detail */}
            {currentDevice && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                    <p className="text-xs text-slate-500 mb-2">
                        Vị trí: {currentDevice.location || 'Chưa cập nhật'} |
                        Cập nhật lần cuối: {wb?.lastUpdated ? new Date(wb.lastUpdated).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}
                    </p>
                    {wbLoading && (
                        <ProgressBar
                            progress={75}
                            status="loading"
                            label="Đang tải dữ liệu water balance"
                            showPercentage={false}
                        />
                    )}
                </div>
            )}

            {wbLoading ? (
                <div className="space-y-6">
                    <SkeletonStatsGrid count={4} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                    <SkeletonChart height={300} />
                    <SkeletonTable rows={4} cols={4} />
                </div>
            ) : !wb ? (
                <div className="text-center py-8 text-slate-500">Chưa có dữ liệu water balance cho thiết bị này.</div>
            ) : (
                <>
                    {/* FAO-56 Key Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                    <Gauge className="w-5 h-5" />
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="text-sm text-slate-500 border-b border-dashed border-slate-400 cursor-help">Weighted Depletion</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[280px]">
                                            <p>Độ suy giảm thể tích nước tổng hợp (lấy trung bình theo độ sâu). Cho biết lượng nước đã biến mất khỏi vùng rễ do bốc thoát hơi nước.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{wb.weightedDepletion.toFixed(2)}</span>
                                <span className="text-sm text-slate-400">mm</span>
                            </div>
                            <div className="mt-2">
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${safeDiv(wb.weightedDepletion, wb.totalRaw) > 0.8 ? 'bg-red-500' :
                                            safeDiv(wb.weightedDepletion, wb.totalRaw) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(safeDiv(wb.weightedDepletion, wb.totalRaw) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {(safeDiv(wb.weightedDepletion, wb.totalRaw) * 100).toFixed(1)}% của RAW
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                                    <Droplets className="w-5 h-5" />
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="text-sm text-slate-500 border-b border-dashed border-slate-400 cursor-help">Total TAW</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[280px]">
                                            <p><b>TAW (Tổng nước hữu dụng):</b> Lượng nước tối đa mà đất có thể giữ lại cho cây trồng sử dụng trước khi cây héo vĩnh viễn.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{wb.totalTaw.toFixed(2)}</span>
                                <span className="text-sm text-slate-400">mm</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                                Shallow: {wb.shallowTaw.toFixed(1)}mm | Deep: {wb.deepTaw.toFixed(1)}mm
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                    <Target className="w-5 h-5" />
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="text-sm text-slate-500 border-b border-dashed border-slate-400 cursor-help">Total RAW</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[280px]">
                                            <p><b>RAW (Nước dễ lấy):</b> Lượng nước cây trồng có thể dễ dàng hút được mà không bị căng thẳng (stress). Khi lượng nước mất đi vượt qua mức này, cần phải tưới.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{wb.totalRaw.toFixed(2)}</span>
                                <span className="text-sm text-slate-400">mm</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                                Shallow: {wb.shallowRaw.toFixed(1)}mm | Deep: {wb.deepRaw.toFixed(1)}mm
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                                    <CloudRain className="w-5 h-5" />
                                </div>
                                <span className="text-sm text-slate-500">Lần tưới cuối</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{wb.lastIrrigation.toFixed(1)}</span>
                                <span className="text-sm text-slate-400">mm</span>
                            </div>
                            {wb.soilMoisTrend !== null && (
                                <div className="mt-2 text-xs text-slate-500">
                                    Xu hướng: {wb.soilMoisTrend > 0 ? '+' : ''}{wb.soilMoisTrend.toFixed(2)}%
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Layer Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Shallow Layer */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Sun className="w-5 h-5 text-blue-500" />
                                Lớp nông (Shallow Layer)
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-sm text-slate-600 border-b border-dashed border-slate-300 cursor-help">Depletion:</span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[250px]">
                                                <p>Lượng nước đã thâm hụt (mất đi) tại lớp đất nông. Nếu con số này vượt qua RAW, cây trồng bắt đầu bị khô héo.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <span className="font-medium text-slate-800">{wb.shallowDepletion.toFixed(2)} mm</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">TAW:</span>
                                    <span className="font-medium text-slate-800">{wb.shallowTaw.toFixed(2)} mm</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">RAW:</span>
                                    <span className="font-medium text-slate-800">{wb.shallowRaw.toFixed(2)} mm</span>
                                </div>
                                <div className="mt-4">
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(safeDiv(wb.shallowDepletion, wb.shallowRaw) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 text-right">
                                        {(safeDiv(wb.shallowDepletion, wb.shallowRaw) * 100).toFixed(1)}% depletion
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Deep Layer */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Wind className="w-5 h-5 text-teal-500" />
                                Lớp sâu (Deep Layer)
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-sm text-slate-600 border-b border-dashed border-slate-300 cursor-help">Depletion:</span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[250px]">
                                                <p>Lượng nước đã thâm hụt (mất đi) tại lớp đất sâu. Rễ cây chậm phát triển tới lớp này, do đó lượng nước ở mức này dự trữ lâu dài hơn.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <span className="font-medium text-slate-800">{wb.deepDepletion.toFixed(2)} mm</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">TAW:</span>
                                    <span className="font-medium text-slate-800">{wb.deepTaw.toFixed(2)} mm</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">RAW:</span>
                                    <span className="font-medium text-slate-800">{wb.deepRaw.toFixed(2)} mm</span>
                                </div>
                                <div className="mt-4">
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-teal-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(safeDiv(wb.deepDepletion, wb.deepRaw) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 text-right">
                                        {(safeDiv(wb.deepDepletion, wb.deepRaw) * 100).toFixed(1)}% depletion
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Depletion Chart */}
                    {depletionChartData.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-teal-500" />
                                Biểu đồ Depletion theo thời gian
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <ComposedChart data={depletionChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{
                                            backgroundColor: '#fff', border: '1px solid #e2e8f0',
                                            borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px',
                                        }}
                                    />
                                    <Bar dataKey="shallow" fill="#3b82f6" name="Shallow (mm)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="deep" fill="#14b8a6" name="Deep (mm)" radius={[4, 4, 0, 0]} />
                                    <Line type="monotone" dataKey="weighted" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Weighted (mm)" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Water Balance State Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-teal-500" />
                                Chi tiết Water Balance State
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Chỉ số</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Lớp nông</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Lớp sâu</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tổng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="border-b border-dashed border-slate-400 cursor-help">Depletion (mm)</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        <p>Lượng nước thâm hụt hiện tại trong đất.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{wb.shallowDepletion.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.deepDepletion.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wb.weightedDepletion.toFixed(2)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="border-b border-dashed border-slate-400 cursor-help">TAW (mm)</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        <p>Tổng lượng nước hữu dụng trong vùng rễ.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{wb.shallowTaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.deepTaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wb.totalTaw.toFixed(2)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="border-b border-dashed border-slate-400 cursor-help">RAW (mm)</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        <p>Lượng nước dễ lấy nhất cho cây trồng.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{wb.shallowRaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.deepRaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wb.totalRaw.toFixed(2)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50 transition-colors bg-slate-50/30">
                                        <td className="px-4 py-3 font-medium text-slate-700">Last Irrigation (mm)</td>
                                        <td colSpan={3} className="px-4 py-3 font-medium text-slate-800">{wb.lastIrrigation.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================
// PREDICTIONS PAGE (MAIN)
// ============================================

export const PredictionsPage: React.FC = () => {
    const { selectedDeviceId } = useMonitoringDevice();
    const { data: devicesFromApi, isLoading: devicesLoading } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
        retry: false,
    });
    const devices = devicesFromApi ?? [];

    const currentDevice = devices.find(d => d.id === selectedDeviceId);
    const isOffline = currentDevice ? currentDevice.status !== 'ONLINE' : false;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dự báo</h1>
                <p className="text-slate-500 mt-1">Kết quả dự báo từ mô hình ANFIS/ML, hệ thống logic mờ và giám sát FAO-56 Water Balance</p>
            </div>

            {devicesLoading && (
                <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3 text-slate-500 text-sm">
                    Đang tải danh sách thiết bị...
                </div>
            )}
            {!devicesLoading && devices.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-slate-700">
                    Không có thiết bị nào. Vui lòng thêm thiết bị để sử dụng dự báo.
                </div>
            )}

            <Tabs.Root defaultValue="ml">
                <Tabs.List className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                    <Tabs.Trigger value="ml" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                        <Brain className="w-4 h-4" /> Dự báo ML
                    </Tabs.Trigger>
                    <Tabs.Trigger value="water-balance" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                        <Gauge className="w-4 h-4" /> FAO-56 Water Balance
                    </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="ml" className="mt-6">
                    <MLPredictionsTab selectedDeviceId={selectedDeviceId} isOffline={isOffline} />
                </Tabs.Content>
                <Tabs.Content value="water-balance" className="mt-6">
                    <WaterBalanceMonitoringTab
                        selectedDeviceId={selectedDeviceId}
                        devices={devices}
                        devicesLoading={devicesLoading}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};
