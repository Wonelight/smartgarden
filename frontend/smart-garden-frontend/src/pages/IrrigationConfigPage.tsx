import React, { useState, useEffect } from 'react';
import {
    Settings2, Droplets, Zap, Power, Loader2,
    Minus, Plus, ToggleLeft, ToggleRight, Gauge,
    Thermometer, Wind, Sun, AlertCircle
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceApi } from '../api/device';
import { irrigationApi } from '../api/irrigation';
import { sensorApi } from '../api/sensor';
import type { IrrigationConfig } from '../types/dashboard';

const fallbackConfig: IrrigationConfig = {
    id: 0, deviceId: 0, autoMode: false, fuzzyEnabled: false,
    soilMoistureMin: 30, soilMoistureMax: 70, wateringDuration: 30,
};

// ============================================
// IRRIGATION CONFIG PAGE
// ============================================

export const IrrigationConfigPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [deviceId, setDeviceId] = useState<number | null>(null);
    const [config, setConfig] = useState<IrrigationConfig>(fallbackConfig);
    const [isIrrigating, setIsIrrigating] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saved, setSaved] = useState(false);

    const { data: devices = [] } = useQuery({ queryKey: ['myDevices'], queryFn: deviceApi.getMyDevices });
    const { data: configRes } = useQuery({
        queryKey: ['irrigationConfig', deviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(deviceId!),
        enabled: !!deviceId,
    });
    const { data: sensorRes } = useQuery({
        queryKey: ['sensorLatest', deviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    useEffect(() => {
        if (devices.length > 0 && deviceId === null) setDeviceId(devices[0].id);
    }, [devices, deviceId]);

    useEffect(() => {
        if (configRes) {
            setConfig({
                id: configRes.id,
                deviceId: configRes.deviceId,
                autoMode: configRes.autoMode ?? false,
                fuzzyEnabled: configRes.fuzzyEnabled ?? false,
                soilMoistureMin: configRes.soilMoistureMin ?? 30,
                soilMoistureMax: configRes.soilMoistureMax ?? 70,
                wateringDuration: configRes.irrigationDurationMax ?? configRes.irrigationDurationMin ?? 30,
            });
        }
    }, [configRes]);

    const saveMutation = useMutation({
        mutationFn: () => irrigationApi.userUpdateConfig(deviceId!, {
            soilMoistureMin: config.soilMoistureMin,
            soilMoistureMax: config.soilMoistureMax,
            irrigationDurationMin: config.wateringDuration,
            irrigationDurationMax: config.wateringDuration,
            autoMode: config.autoMode,
            fuzzyEnabled: config.fuzzyEnabled,
        }),
        onSuccess: () => {
            setSaved(true);
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] });
            setTimeout(() => setSaved(false), 2000);
        },
    });

    const handleConfigChange = (updates: Partial<IrrigationConfig>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
        setSaved(false);
    };

    const handleSave = () => {
        if (!deviceId) return;
        saveMutation.mutate();
    };

    const handleManualIrrigation = async () => {
        setShowConfirm(false);
        setIsIrrigating(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setIsIrrigating(false);
    };

    const handleSliderChange = (field: 'soilMoistureMin' | 'soilMoistureMax', value: number) => {
        if (field === 'soilMoistureMin' && value >= config.soilMoistureMax) return;
        if (field === 'soilMoistureMax' && value <= config.soilMoistureMin) return;
        handleConfigChange({ [field]: value });
    };

    const handleDurationChange = (delta: number) => {
        const next = Math.max(5, Math.min(600, config.wateringDuration + delta));
        handleConfigChange({ wateringDuration: next });
    };

    const currentSensor = sensorRes
        ? { soilMoisture: sensorRes.soilMoisture ?? 0, temperature: sensorRes.temperature ?? 0, humidity: sensorRes.humidity ?? 0, lightIntensity: sensorRes.lightIntensity ?? 0 }
        : { soilMoisture: 0, temperature: 0, humidity: 0, lightIntensity: 0 };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cấu hình tưới</h1>
                    <p className="text-slate-500 mt-1">Thiết lập chế độ tưới tự động và ngưỡng cảm biến</p>
                </div>
                <div className="flex items-center gap-3">
                    {devices.length > 0 && (
                        <select
                            value={deviceId ?? ''}
                            onChange={(e) => setDeviceId(Number(e.target.value))}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>{d.deviceName}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!deviceId || saveMutation.isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${saved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600 shadow-sm disabled:opacity-50'
                            }`}
                    >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Đã lưu' : 'Lưu cấu hình'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Configuration */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Mode Switches */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-700 mb-5 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-teal-500" />
                            Chế độ hoạt động
                        </h2>
                        <div className="space-y-5">
                            {/* Auto Mode */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-teal-50 text-teal-500">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-700">Chế độ tự động</p>
                                        <p className="text-xs text-slate-400">Tự động tưới khi độ ẩm thấp hơn ngưỡng</p>
                                    </div>
                                </div>
                                <Switch.Root
                                    checked={config.autoMode}
                                    onCheckedChange={(checked) => handleConfigChange({ autoMode: checked })}
                                    className="w-11 h-6 bg-slate-200 rounded-full relative data-[state=checked]:bg-teal-500 transition-colors cursor-pointer"
                                >
                                    <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                                </Switch.Root>
                            </div>

                            {/* Fuzzy Logic */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-50 text-purple-500">
                                        <Gauge className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-700">Fuzzy Logic</p>
                                        <p className="text-xs text-slate-400">Sử dụng logic mờ để tối ưu lượng nước</p>
                                    </div>
                                </div>
                                <Switch.Root
                                    checked={config.fuzzyEnabled}
                                    onCheckedChange={(checked) => handleConfigChange({ fuzzyEnabled: checked })}
                                    className="w-11 h-6 bg-slate-200 rounded-full relative data-[state=checked]:bg-purple-500 transition-colors cursor-pointer"
                                >
                                    <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                                </Switch.Root>
                            </div>
                        </div>
                    </div>

                    {/* Thresholds */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-700 mb-5 flex items-center gap-2">
                            <Droplets className="w-5 h-5 text-blue-500" />
                            Ngưỡng độ ẩm đất
                        </h2>
                        <div className="space-y-8">
                            {/* Min Threshold */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-medium text-slate-700">Ngưỡng tối thiểu</p>
                                        <p className="text-xs text-slate-400">Bắt đầu tưới khi ẩm đất thấp hơn</p>
                                    </div>
                                    <span className="text-2xl font-bold text-red-500">{config.soilMoistureMin}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={90}
                                    value={config.soilMoistureMin}
                                    onChange={(e) => handleSliderChange('soilMoistureMin', Number(e.target.value))}
                                    className="w-full h-2 bg-gradient-to-r from-red-200 to-red-400 rounded-full appearance-none cursor-pointer accent-red-500"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>10%</span>
                                    <span>90%</span>
                                </div>
                            </div>

                            {/* Max Threshold */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-medium text-slate-700">Ngưỡng tối đa</p>
                                        <p className="text-xs text-slate-400">Ngừng tưới khi ẩm đất cao hơn</p>
                                    </div>
                                    <span className="text-2xl font-bold text-blue-500">{config.soilMoistureMax}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={90}
                                    value={config.soilMoistureMax}
                                    onChange={(e) => handleSliderChange('soilMoistureMax', Number(e.target.value))}
                                    className="w-full h-2 bg-gradient-to-r from-blue-200 to-blue-400 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>10%</span>
                                    <span>90%</span>
                                </div>
                            </div>

                            {/* Visual range bar */}
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <p className="text-xs text-slate-500 mb-2">Phạm vi hoạt động</p>
                                <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="absolute h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                                        style={{
                                            left: `${config.soilMoistureMin}%`,
                                            width: `${config.soilMoistureMax - config.soilMoistureMin}%`,
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span className="text-red-500 font-medium">{config.soilMoistureMin}% (Khô)</span>
                                    <span className="text-blue-500 font-medium">{config.soilMoistureMax}% (Ẩm)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-700 mb-5 flex items-center gap-2">
                            <Power className="w-5 h-5 text-emerald-500" />
                            Thời gian tưới
                        </h2>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => handleDurationChange(-5)}
                                className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <Minus className="w-5 h-5" />
                            </button>
                            <div className="text-center min-w-[120px]">
                                <span className="text-4xl font-bold text-slate-800">{config.wateringDuration}</span>
                                <p className="text-sm text-slate-400 mt-1">giây / lần tưới</p>
                            </div>
                            <button
                                onClick={() => handleDurationChange(5)}
                                className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mt-4 text-center text-xs text-slate-400">
                            Phạm vi: 5 – 600 giây ({Math.floor(config.wateringDuration / 60)} phút {config.wateringDuration % 60} giây)
                        </div>
                    </div>
                </div>

                {/* Right Column - Current Sensor & Manual Control */}
                <div className="space-y-6">
                    {/* Current Sensor Readings */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Cảm biến hiện tại</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50">
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-slate-600">Độ ẩm đất</span>
                                </div>
                                <span className={`font-bold ${currentSensor.soilMoisture < config.soilMoistureMin ? 'text-red-500' : currentSensor.soilMoisture > config.soilMoistureMax ? 'text-blue-500' : 'text-emerald-600'
                                    }`}>
                                    {currentSensor.soilMoisture}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50">
                                <div className="flex items-center gap-2">
                                    <Thermometer className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm text-slate-600">Nhiệt độ</span>
                                </div>
                                <span className="font-bold text-slate-800">{currentSensor.temperature}°C</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50/50">
                                <div className="flex items-center gap-2">
                                    <Wind className="w-4 h-4 text-cyan-500" />
                                    <span className="text-sm text-slate-600">Độ ẩm KK</span>
                                </div>
                                <span className="font-bold text-slate-800">{currentSensor.humidity}%</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50/50">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-4 h-4 text-yellow-500" />
                                    <span className="text-sm text-slate-600">Ánh sáng</span>
                                </div>
                                <span className="font-bold text-slate-800">{currentSensor.lightIntensity.toLocaleString()} lux</span>
                            </div>
                        </div>
                        {currentSensor.soilMoisture < config.soilMoistureMin && (
                            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                Độ ẩm dưới ngưỡng tối thiểu!
                            </div>
                        )}
                    </div>

                    {/* Manual Irrigation */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Tưới thủ công</h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Kích hoạt máy bơm ngay lập tức trong {config.wateringDuration} giây
                        </p>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isIrrigating}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all ${isIrrigating
                                ? 'bg-blue-100 text-blue-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm'
                                }`}
                        >
                            {isIrrigating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang tưới...
                                </>
                            ) : (
                                <>
                                    <Power className="w-5 h-5" />
                                    Bắt đầu tưới
                                </>
                            )}
                        </button>
                        {isIrrigating && (
                            <div className="mt-3">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">Máy bơm đang hoạt động</p>
                            </div>
                        )}
                    </div>

                    {/* Config Summary */}
                    <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-sm">
                        <h3 className="font-semibold mb-3">Tóm tắt cấu hình</h3>
                        <div className="space-y-2 text-sm text-white/90">
                            <div className="flex justify-between">
                                <span>Auto Mode</span>
                                <span className="font-medium">{config.autoMode ? 'Bật' : 'Tắt'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Fuzzy Logic</span>
                                <span className="font-medium">{config.fuzzyEnabled ? 'Bật' : 'Tắt'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ngưỡng ẩm</span>
                                <span className="font-medium">{config.soilMoistureMin}% – {config.soilMoistureMax}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Thời gian tưới</span>
                                <span className="font-medium">{config.wateringDuration}s</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
                        <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Power className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Xác nhận tưới thủ công</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Máy bơm sẽ hoạt động trong <strong>{config.wateringDuration} giây</strong>. Bạn có chắc chắn?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                Hủy
                            </button>
                            <button onClick={handleManualIrrigation} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-cyan-600 transition-all">
                                Bắt đầu tưới
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
