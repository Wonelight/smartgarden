import React, { useState, useEffect } from 'react';
import {
    Brain, Zap, TrendingUp, BarChart3, Droplets,
    Target, Activity, Gauge, CloudRain, Sun, Wind
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Line, Area, AreaChart,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    LineChart, ComposedChart,
} from 'recharts';
import { mockFuzzyResults } from '../mocks/smartGardenMocks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi, type UserDeviceListItem } from '../api/device';
import { waterBalanceApi } from '../api/waterBalance';
import { aiApi } from '../api/ai';
import { sensorApi } from '../api/sensor';
import { toast } from 'sonner';
import { SkeletonCard, SkeletonStatsGrid, SkeletonChart, SkeletonTable } from '../components/ui/Skeleton';
import { ProgressBar } from '../components/ui/ProgressBar';

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

const MLPredictionsTab: React.FC<{ selectedDeviceId: number | null }> = ({ selectedDeviceId }) => {
    const queryClient = useQueryClient();

    const { data: latestResult, isLoading: loadingLatest, error: errorLatest } = useQuery({
        queryKey: ['aiLatestResult', selectedDeviceId],
        queryFn: () => aiApi.getLatestResult(selectedDeviceId!),
        enabled: !!selectedDeviceId,
        retry: false,
    });

    const { data: latestSensor, isLoading: loadingSensor, error: errorSensor } = useQuery({
        queryKey: ['sensorLatest', selectedDeviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(selectedDeviceId!),
        enabled: !!selectedDeviceId,
        retry: false,
    });

    const predictMutation = useMutation({
        mutationFn: (payload: { deviceId: number; sensorDataId: number }) => aiApi.predict(payload),
        onSuccess: () => {
            toast.success('Đã gọi dự báo AI thành công.');
            queryClient.invalidateQueries({ queryKey: ['aiLatestResult', selectedDeviceId] });
        },
        onError: (err: unknown) => {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Lỗi gọi AI';
            toast.error(msg);
        },
    });

    const confidence = latestResult?.modelAccuracy ?? latestResult?.anfisAccuracy ?? 0;
    const chartData = latestResult
        ? [{
            time: new Date(latestResult.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            waterAmount: latestResult.predictedWaterAmount ?? 0,
            confidence: Math.round(confidence * 100),
        }]
        : [];

    const modelVersion = (latestResult?.anfisParams as Record<string, unknown> | undefined)?.model as string ?? '—';

    if (!selectedDeviceId) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-slate-500">
                Chọn thiết bị ở tab &quot;FAO-56 Water Balance&quot; hoặc danh sách bên trên để xem dự báo ML.
            </div>
        );
    }

    const hasSensorData = !!latestSensor && !errorSensor;
    const noSensorData = selectedDeviceId && !loadingSensor && (!!errorSensor || !latestSensor);

    if (errorLatest && (errorLatest as { response?: { status?: number } })?.response?.status === 404) {
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
                        onClick={() => predictMutation.mutate({ deviceId: selectedDeviceId, sensorDataId: latestSensor.id })}
                        disabled={predictMutation.isPending}
                        className="px-4 py-2 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 disabled:opacity-50"
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
                        <span className="text-sm text-slate-500">Độ tin cậy</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{loadingLatest ? '—' : Math.round(confidence * 100)}</span>
                        <span className="text-sm text-slate-400">%</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><Droplets className="w-5 h-5" /></div>
                        <span className="text-sm text-slate-500">Lượng nước dự báo</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{loadingLatest ? '—' : (latestResult?.predictedWaterAmount ?? 0).toFixed(1)}</span>
                        <span className="text-sm text-slate-400">mm</span>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><Brain className="w-5 h-5" /></div>
                        <span className="text-sm text-slate-500">Model</span>
                    </div>
                    <span className="text-lg font-bold text-slate-800 font-mono">{loadingLatest ? '—' : modelVersion}</span>
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
                    onClick={() => predictMutation.mutate({ deviceId: selectedDeviceId, sensorDataId: latestSensor!.id })}
                    disabled={predictMutation.isPending}
                    className="px-4 py-2 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 disabled:opacity-50"
                >
                    {predictMutation.isPending ? 'Đang gọi...' : 'Gọi dự báo AI (mới nhất)'}
                </button>
            )}

            {chartData.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-500" />
                        Dự báo lượng nước (kết quả mới nhất)
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
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px' }} />
                            <Area type="monotone" dataKey="waterAmount" stroke="#14b8a6" strokeWidth={2} fill="url(#waterGrad)" name="Lượng nước (mm)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {latestResult && (
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{new Date(latestResult.createdAt).toLocaleString('vi-VN')}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{latestResult.predictedWaterAmount ?? 0} mm</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round(confidence * 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{Math.round(confidence * 100)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">{latestResult.predictionType ?? 'WATER_NEED'}</span></td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{latestResult.predictedDuration ?? '—'} s</td>
                                </tr>
                            </tbody>
                        </table>
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
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px' }} />
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
    setSelectedDeviceId: (id: number | null) => void;
    devices: UserDeviceListItem[];
    devicesLoading: boolean;
}> = ({ selectedDeviceId, setSelectedDeviceId, devices, devicesLoading }) => {
    const { data: waterBalanceState, isLoading: wbLoading } = useQuery({
        queryKey: ['waterBalanceState', selectedDeviceId],
        queryFn: () => waterBalanceApi.getWaterBalanceState(selectedDeviceId!),
        enabled: selectedDeviceId !== null,
        retry: false,
    });

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
                    {/* Device Selector */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn thiết bị</label>
                <select
                    value={selectedDeviceId || ''}
                    onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                    className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                    {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                            {device.deviceName} ({device.deviceCode})
                        </option>
                    ))}
                </select>
                {currentDevice && (
                    <div className="mt-3">
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
            </div>

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
                                <span className="text-sm text-slate-500">Weighted Depletion</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{wb.weightedDepletion.toFixed(2)}</span>
                                <span className="text-sm text-slate-400">mm</span>
                            </div>
                            <div className="mt-2">
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${
                                            wb.weightedDepletion / wb.totalRaw > 0.8 ? 'bg-red-500' :
                                            wb.weightedDepletion / wb.totalRaw > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min((wb.weightedDepletion / wb.totalRaw) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {((wb.weightedDepletion / wb.totalRaw) * 100).toFixed(1)}% của RAW
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                                    <Droplets className="w-5 h-5" />
                                </div>
                                <span className="text-sm text-slate-500">Total TAW</span>
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
                                <span className="text-sm text-slate-500">Total RAW</span>
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
                                    <span className="text-sm text-slate-600">Depletion:</span>
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
                                            style={{ width: `${Math.min((wb.shallowDepletion / wb.shallowRaw) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 text-right">
                                        {((wb.shallowDepletion / wb.shallowRaw) * 100).toFixed(1)}% depletion
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
                                    <span className="text-sm text-slate-600">Depletion:</span>
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
                                            style={{ width: `${Math.min((wb.deepDepletion / wb.deepRaw) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 text-right">
                                        {((wb.deepDepletion / wb.deepRaw) * 100).toFixed(1)}% depletion
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
                                    <Tooltip
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
                                        <td className="px-4 py-3 font-medium text-slate-700">Depletion (mm)</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.shallowDepletion.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.deepDepletion.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wb.weightedDepletion.toFixed(2)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">TAW (mm)</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.shallowTaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-slate-600">{wb.deepTaw.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{wb.totalTaw.toFixed(2)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700">RAW (mm)</td>
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
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const { data: devicesFromApi, isLoading: devicesLoading } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
        retry: false,
    });
    const devices = devicesFromApi ?? [];

    useEffect(() => {
        if (devices.length > 0 && selectedDeviceId === null) setSelectedDeviceId(devices[0].id);
    }, [devices, selectedDeviceId]);

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
            {!devicesLoading && devices.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700">Thiết bị:</label>
                    <select
                        value={selectedDeviceId ?? ''}
                        onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {devices.map((d) => (
                            <option key={d.id} value={d.id}>{d.deviceName} ({d.deviceCode})</option>
                        ))}
                    </select>
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
                    <Tabs.Trigger value="fuzzy" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                        <Zap className="w-4 h-4" /> Fuzzy Logic
                    </Tabs.Trigger>
                    <Tabs.Trigger value="water-balance" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                        <Gauge className="w-4 h-4" /> FAO-56 Water Balance
                    </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="ml" className="mt-6">
                    <MLPredictionsTab selectedDeviceId={selectedDeviceId} />
                </Tabs.Content>
                <Tabs.Content value="fuzzy" className="mt-6">
                    <FuzzyLogicTab />
                </Tabs.Content>
                <Tabs.Content value="water-balance" className="mt-6">
                    <WaterBalanceMonitoringTab
                        selectedDeviceId={selectedDeviceId}
                        setSelectedDeviceId={setSelectedDeviceId}
                        devices={devices}
                        devicesLoading={devicesLoading}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};
