import React from 'react';
import {
    Wifi, WifiOff, Droplets, Thermometer,
    Wind, Sun, CloudRain, TrendingUp
} from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    progress?: {
        value: number;
        max: number;
        color: string;
    };
    status?: 'online' | 'offline';
    subtitle?: string;
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    unit,
    icon,
    trend,
    progress,
    status,
    subtitle,
    className = '',
}) => {
    return (
        <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${className}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600">
                    {icon}
                </div>
                {status && (
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status === 'online'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-500'
                        }`}>
                        {status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {status === 'online' ? 'Online' : 'Offline'}
                    </span>
                )}
                {trend && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                        <TrendingUp className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`} />
                        {trend.value}%
                    </span>
                )}
            </div>

            <div className="space-y-1">
                <p className="text-sm text-slate-500 font-medium">{title}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-800">{value}</span>
                    {unit && <span className="text-sm text-slate-400">{unit}</span>}
                </div>
                {subtitle && (
                    <p className="text-xs text-slate-400">{subtitle}</p>
                )}
            </div>

            {progress && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>Progress</span>
                        <span>{Math.round((progress.value / progress.max) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progress.color}`}
                            style={{ width: `${(progress.value / progress.max) * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// Pre-configured stat card variants
interface DeviceStatusCardProps {
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    lastOnline: string;
}

export const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({ name, status, lastOnline }) => {
    const formattedTime = new Date(lastOnline).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });

    return (
        <StatCard
            title="Trạng thái thiết bị"
            value={name}
            icon={status === 'ONLINE' ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            status={status.toLowerCase() as 'online' | 'offline'}
            subtitle={`Cập nhật: ${formattedTime}`}
        />
    );
};

interface SoilMoistureCardProps {
    value: number;
    min: number;
    max: number;
}

export const SoilMoistureCard: React.FC<SoilMoistureCardProps> = ({ value, min, max }) => {
    const getColor = () => {
        if (value < min) return 'bg-gradient-to-r from-red-400 to-red-500';
        if (value > max) return 'bg-gradient-to-r from-blue-400 to-blue-500';
        return 'bg-gradient-to-r from-emerald-400 to-teal-500';
    };

    return (
        <StatCard
            title="Độ ẩm đất"
            value={value}
            unit="%"
            icon={<Droplets className="w-5 h-5" />}
            progress={{ value, max: 100, color: getColor() }}
            subtitle={`Ngưỡng: ${min}% - ${max}%`}
        />
    );
};

interface EnvironmentCardProps {
    temperature: number;
    humidity: number;
}

export const EnvironmentCard: React.FC<EnvironmentCardProps> = ({ temperature, humidity }) => {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-500">
                    <Thermometer className="w-5 h-5" />
                </div>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-3">Môi trường</p>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-xs">Nhiệt độ</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-slate-800">{temperature}</span>
                        <span className="text-sm text-slate-400">°C</span>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Wind className="w-4 h-4" />
                        <span className="text-xs">Độ ẩm</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-slate-800">{humidity}</span>
                        <span className="text-sm text-slate-400">%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PredictionCardProps {
    predictedWaterAmount: number;
    confidence: number;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ predictedWaterAmount, confidence }) => {
    return (
        <StatCard
            title="Dự báo 24h tới"
            value={predictedWaterAmount.toFixed(1)}
            unit="lít"
            icon={<CloudRain className="w-5 h-5" />}
            trend={{ value: Math.round(confidence * 100), isPositive: true }}
            subtitle="Lượng nước cần thiết"
        />
    );
};

interface LightIntensityCardProps {
    value: number;
}

export const LightIntensityCard: React.FC<LightIntensityCardProps> = ({ value }) => {
    const getLevel = () => {
        if (value < 1000) return 'Thấp';
        if (value < 5000) return 'Trung bình';
        return 'Cao';
    };

    return (
        <StatCard
            title="Cường độ ánh sáng"
            value={value.toLocaleString()}
            unit="lux"
            icon={<Sun className="w-5 h-5" />}
            subtitle={`Mức: ${getLevel()}`}
        />
    );
};
