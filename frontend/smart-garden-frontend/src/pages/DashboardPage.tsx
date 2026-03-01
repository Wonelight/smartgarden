import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    DeviceStatusCard,
    SoilMoistureCard,
    EnvironmentCard,
    PredictionCard,
    LightIntensityCard,
    ControlPanel,
    SensorLineChart,
    WaterUsageBarChart,
    LogTable,
    ScheduleList,
} from '../components/dashboard';
import type {
    DeviceStatus,
    SensorData,
    IrrigationConfig,
    MLPrediction,
    SystemLog,
    Schedule,
    SensorChartData,
    WaterUsageData,
} from '../types/dashboard';
import { deviceApi } from '../api/device';
import { sensorApi } from '../api/sensor';
import { irrigationApi } from '../api/irrigation';
import { aiApi } from '../api/ai';

// ============================================
// FALLBACK MOCK (when no device or API error)
// ============================================

const fallbackDevice: DeviceStatus = {
    id: 0,
    name: 'Chưa có thiết bị',
    status: 'OFFLINE',
    lastOnline: null,
    gpioPin: 0,
};

const fallbackSensor: SensorData = {
    id: 0,
    deviceId: 0,
    soilMoisture: 0,
    temperature: 0,
    humidity: 0,
    lightIntensity: 0,
    timestamp: new Date().toISOString(),
};

const fallbackConfig: IrrigationConfig = {
    id: 0,
    deviceId: 0,
    autoMode: false,
    fuzzyEnabled: false,
    soilMoistureMin: 30,
    soilMoistureMax: 70,
    wateringDuration: 30,
};

const fallbackPrediction: MLPrediction = {
    id: 0,
    deviceId: 0,
    predictedWaterAmount: 0,
    predictedTime: new Date().toISOString(),
    confidence: 0,
    createdAt: new Date().toISOString(),
};

const mockLogs: SystemLog[] = [
    { id: 1, logLevel: 'INFO', source: 'Hệ thống', message: 'Kết nối dashboard. Chọn thiết bị để xem dữ liệu thực.', timestamp: new Date().toISOString() },
];

const mockSchedules: Schedule[] = [];
const mockSensorChartData: SensorChartData[] = [
    { time: '06:00', soilMoisture: 0, lightIntensity: 0 },
    { time: '12:00', soilMoisture: 0, lightIntensity: 0 },
    { time: '18:00', soilMoisture: 0, lightIntensity: 0 },
];
const mockWaterUsageData: WaterUsageData[] = [
    { day: 'T2', waterVolume: 0 }, { day: 'T3', waterVolume: 0 }, { day: 'T4', waterVolume: 0 },
    { day: 'T5', waterVolume: 0 }, { day: 'T6', waterVolume: 0 }, { day: 'T7', waterVolume: 0 }, { day: 'CN', waterVolume: 0 },
];

// ============================================
// DASHBOARD PAGE COMPONENT
// ============================================

export const DashboardPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data: devices = [] } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
    });

    const deviceId = devices.length > 0 ? devices[0].id : null;

    const { data: sensorDetail, isLoading: loadingSensor } = useQuery({
        queryKey: ['sensorLatest', deviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    const { data: irrigationConfig, isLoading: loadingConfig } = useQuery({
        queryKey: ['irrigationConfig', deviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    const { data: aiResult, isLoading: loadingAi } = useQuery({
        queryKey: ['aiLatestResult', deviceId],
        queryFn: () => aiApi.getLatestResult(deviceId!),
        enabled: !!deviceId,
        retry: false,
    });

    const handleConfigChange = (updates: Partial<IrrigationConfig>) => {
        if (!deviceId) return;
        irrigationApi.userUpdateConfig(deviceId, {
            soilMoistureMin: updates.soilMoistureMin,
            soilMoistureMax: updates.soilMoistureMax,
            irrigationDurationMin: updates.wateringDuration,
            irrigationDurationMax: updates.wateringDuration,
            autoMode: updates.autoMode,
            fuzzyEnabled: updates.fuzzyEnabled,
        }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] });
        }).catch(() => {});
    };

    const handleManualIrrigation = async () => {
        if (!deviceId) return;
        // Manual irrigation would call device control API; keep placeholder
        console.log('Manual irrigation triggered for device', deviceId);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['myDevices'] }),
            queryClient.invalidateQueries({ queryKey: ['sensorLatest', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['aiLatestResult', deviceId] }),
        ]);
        setIsRefreshing(false);
    };

    const handleScheduleToggle = (id: number, isActive: boolean) => {
        console.log(`Schedule ${id} toggled to ${isActive}`);
    };

    const device: DeviceStatus = deviceId && devices[0]
        ? {
            id: devices[0].id,
            name: devices[0].deviceName,
            status: devices[0].status,
            lastOnline: devices[0].lastOnline ?? null,
            gpioPin: 0,
        }
        : fallbackDevice;

    const sensor: SensorData = sensorDetail
        ? {
            id: sensorDetail.id,
            deviceId: sensorDetail.deviceId,
            soilMoisture: sensorDetail.soilMoisture ?? 0,
            temperature: sensorDetail.temperature ?? 0,
            humidity: sensorDetail.humidity ?? 0,
            lightIntensity: sensorDetail.lightIntensity ?? 0,
            timestamp: sensorDetail.timestamp,
        }
        : fallbackSensor;

    const config: IrrigationConfig = irrigationConfig
        ? {
            id: irrigationConfig.id,
            deviceId: irrigationConfig.deviceId,
            autoMode: irrigationConfig.autoMode ?? false,
            fuzzyEnabled: irrigationConfig.fuzzyEnabled ?? false,
            soilMoistureMin: irrigationConfig.soilMoistureMin ?? 30,
            soilMoistureMax: irrigationConfig.soilMoistureMax ?? 70,
            wateringDuration: irrigationConfig.irrigationDurationMax ?? irrigationConfig.irrigationDurationMin ?? 30,
        }
        : fallbackConfig;

    const prediction: MLPrediction = aiResult
        ? {
            id: aiResult.id,
            deviceId: aiResult.deviceId,
            predictedWaterAmount: aiResult.predictedWaterAmount ?? 0,
            predictedTime: aiResult.createdAt,
            confidence: aiResult.modelAccuracy ?? aiResult.anfisAccuracy ?? 0,
            createdAt: aiResult.createdAt,
        }
        : fallbackPrediction;

    const loading = loadingSensor || loadingConfig || loadingAi;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Giám sát và điều khiển hệ thống tưới tiêu thông minh</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing || loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                >
                    {isRefreshing || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Làm mới
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <DeviceStatusCard name={device.name} status={device.status} lastOnline={device.lastOnline} />
                <SoilMoistureCard value={sensor.soilMoisture} min={config.soilMoistureMin} max={config.soilMoistureMax} />
                <EnvironmentCard temperature={sensor.temperature} humidity={sensor.humidity} />
                <PredictionCard predictedWaterAmount={prediction.predictedWaterAmount} confidence={prediction.confidence} />
                <LightIntensityCard value={sensor.lightIntensity} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SensorLineChart data={mockSensorChartData} />
                    <WaterUsageBarChart data={mockWaterUsageData} />
                </div>
                <div>
                    <ControlPanel config={config} onConfigChange={handleConfigChange} onManualIrrigation={handleManualIrrigation} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LogTable logs={mockLogs} />
                <ScheduleList schedules={mockSchedules} onToggle={handleScheduleToggle} />
            </div>
        </div>
    );
};
