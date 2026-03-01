import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Droplets, Thermometer, Wind, Sun, Activity, Clock,
    TrendingUp, TrendingDown, RefreshCw, Gauge, CloudSun, MapPin, Loader2, ChevronDown
} from 'lucide-react';
import { DeviceMap } from '../components/DeviceMap';
import * as Select from '@radix-ui/react-select';
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockUserDevices } from '../mocks/smartGardenMocks';
import type { MonitoringSensorData } from '../types/dashboard';
import { sensorApi } from '../api/sensor';
import { WeatherForecast } from '../components/WeatherForecast';
import { weatherApi } from '../api/weather';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { isAdmin as checkIsAdmin } from '../utils/roleUtils';
import { deviceApi } from '../api/device';
import { useMonitoringDevice } from '../contexts/MonitoringDeviceContext';

// ============================================
// TIME RANGE OPTIONS
// ============================================

type TimeRange = '1h' | '6h' | '12h' | '24h';

const timeRangeLabels: Record<TimeRange, string> = {
    '1h': '1 giờ',
    '6h': '6 giờ',
    '12h': '12 giờ',
    '24h': '24 giờ',
};

// ============================================
// STAT SUMMARY CARD
// ============================================

const SensorSummaryCard: React.FC<{
    title: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    iconBg: string;
    trend?: { value: number; isUp: boolean };
}> = ({ title, value, unit, icon, iconBg, trend }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${iconBg}`}>
                {icon}
            </div>
            {trend && (
                <span className={`flex items-center gap-1 text-xs font-medium ${trend.isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trend.value}%
                </span>
            )}
        </div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-800">{value}</span>
            <span className="text-sm text-slate-400">{unit}</span>
        </div>
    </div>
);

// ============================================
// CHART COMPONENT
// ============================================

const SensorChart: React.FC<{
    title: string;
    data: MonitoringSensorData[];
    dataKey: keyof MonitoringSensorData;
    color: string;
    gradientId: string;
    unit: string;
    icon: React.ReactNode;
}> = ({ title, data, dataKey, color, gradientId, unit, icon }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
            {icon}
            <h3 className="font-semibold text-slate-700">{title}</h3>
            <span className="text-xs text-slate-400 ml-auto">({unit})</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '13px'
                    }}
                    formatter={(value: number | undefined) => {
                        if (value === undefined) return ['', title];
                        return [value.toFixed(1) + ' ' + unit, title];
                    }}
                />
                <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: color }}
                />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

// ============================================
// MONITORING PAGE
// ============================================

// Vietnam cities for OpenWeather
const VIETNAM_CITIES = [
    { name: 'Hà Nội', value: 'Hanoi' },
    { name: 'TP. Hồ Chí Minh', value: 'Ho Chi Minh City' },
    { name: 'Đà Nẵng', value: 'Da Nang' },
    { name: 'Hải Phòng', value: 'Hai Phong' },
    { name: 'Cần Thơ', value: 'Can Tho' },
    { name: 'An Giang', value: 'An Giang' },
    { name: 'Bà Rịa - Vũng Tàu', value: 'Ba Ria - Vung Tau' },
    { name: 'Bắc Giang', value: 'Bac Giang' },
    { name: 'Bắc Kạn', value: 'Bac Kan' },
    { name: 'Bạc Liêu', value: 'Bac Lieu' },
    { name: 'Bắc Ninh', value: 'Bac Ninh' },
    { name: 'Bến Tre', value: 'Ben Tre' },
    { name: 'Bình Định', value: 'Binh Dinh' },
    { name: 'Bình Dương', value: 'Binh Duong' },
    { name: 'Bình Phước', value: 'Binh Phuoc' },
    { name: 'Bình Thuận', value: 'Binh Thuan' },
    { name: 'Cà Mau', value: 'Ca Mau' },
    { name: 'Cao Bằng', value: 'Cao Bang' },
    { name: 'Đắk Lắk', value: 'Dak Lak' },
    { name: 'Đắk Nông', value: 'Dak Nong' },
    { name: 'Điện Biên', value: 'Dien Bien' },
    { name: 'Đồng Nai', value: 'Dong Nai' },
    { name: 'Đồng Tháp', value: 'Dong Thap' },
    { name: 'Gia Lai', value: 'Gia Lai' },
    { name: 'Hà Giang', value: 'Ha Giang' },
    { name: 'Hà Nam', value: 'Ha Nam' },
    { name: 'Hà Tĩnh', value: 'Ha Tinh' },
    { name: 'Hải Dương', value: 'Hai Duong' },
    { name: 'Hậu Giang', value: 'Hau Giang' },
    { name: 'Hòa Bình', value: 'Hoa Binh' },
    { name: 'Hưng Yên', value: 'Hung Yen' },
    { name: 'Khánh Hòa', value: 'Khanh Hoa' },
    { name: 'Kiên Giang', value: 'Kien Giang' },
    { name: 'Kon Tum', value: 'Kon Tum' },
    { name: 'Lai Châu', value: 'Lai Chau' },
    { name: 'Lâm Đồng', value: 'Lam Dong' },
    { name: 'Lạng Sơn', value: 'Lang Son' },
    { name: 'Lào Cai', value: 'Lao Cai' },
    { name: 'Long An', value: 'Long An' },
    { name: 'Nam Định', value: 'Nam Dinh' },
    { name: 'Nghệ An', value: 'Nghe An' },
    { name: 'Ninh Bình', value: 'Ninh Binh' },
    { name: 'Ninh Thuận', value: 'Ninh Thuan' },
    { name: 'Phú Thọ', value: 'Phu Tho' },
    { name: 'Phú Yên', value: 'Phu Yen' },
    { name: 'Quảng Bình', value: 'Quang Binh' },
    { name: 'Quảng Nam', value: 'Quang Nam' },
    { name: 'Quảng Ngãi', value: 'Quang Ngai' },
    { name: 'Quảng Ninh', value: 'Quang Ninh' },
    { name: 'Quảng Trị', value: 'Quang Tri' },
    { name: 'Sóc Trăng', value: 'Soc Trang' },
    { name: 'Sơn La', value: 'Son La' },
    { name: 'Tây Ninh', value: 'Tay Ninh' },
    { name: 'Thái Bình', value: 'Thai Binh' },
    { name: 'Thái Nguyên', value: 'Thai Nguyen' },
    { name: 'Thanh Hóa', value: 'Thanh Hoa' },
    { name: 'Thừa Thiên Huế', value: 'Thua Thien Hue' },
    { name: 'Tiền Giang', value: 'Tien Giang' },
    { name: 'Trà Vinh', value: 'Tra Vinh' },
    { name: 'Tuyên Quang', value: 'Tuyen Quang' },
    { name: 'Vĩnh Long', value: 'Vinh Long' },
    { name: 'Vĩnh Phúc', value: 'Vinh Phuc' },
    { name: 'Yên Bái', value: 'Yen Bai' },
];

export const MonitoringPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = checkIsAdmin(user);
    const queryClient = useQueryClient();
    const location = useLocation();
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [selectedCity, setSelectedCity] = useState<string>('Hanoi');
    const { selectedDeviceId, setSelectedDeviceId } = useMonitoringDevice();

    const { data: userDevices = [] } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
    });

    const deviceIdForSensor = selectedDeviceId ?? (userDevices.length > 0 ? userDevices[0].id : null);
    const currentDevice = userDevices.find((d) => d.id === selectedDeviceId) ?? userDevices[0] ?? null;

    // Fetch monitored locations for weather widget button
    const { data: locations = {}, isLoading: loadingLocations } = useQuery({
        queryKey: ['monitoredLocations'],
        queryFn: weatherApi.getMonitoredLocations,
        refetchInterval: 5 * 60 * 1000,
    });

    const fetchWeatherMutation = useMutation({
        mutationFn: weatherApi.fetchWeatherNow,
        onSuccess: (msg) => {
            toast.success(msg);
            queryClient.invalidateQueries({ queryKey: ['monitoredLocations'] });
            queryClient.invalidateQueries({ queryKey: ['currentWeather'] });
            queryClient.invalidateQueries({ queryKey: ['weatherForecast'] });
        },
        onError: () => toast.error('Lỗi khi cập nhật thời tiết'),
    });

    const locationCount = Object.keys(locations).length;

    React.useEffect(() => {
        const stateDeviceId = (location.state as { deviceId?: number })?.deviceId;
        if (stateDeviceId != null && userDevices.some((d) => d.id === stateDeviceId)) {
            setSelectedDeviceId(stateDeviceId);
        }
    }, [location.state, userDevices]);

    React.useEffect(() => {
        if (userDevices.length > 0 && selectedDeviceId == null) {
            setSelectedDeviceId(userDevices[0].id);
        }
    }, [userDevices, selectedDeviceId]);

    React.useEffect(() => {
        if (userDevices.length > 0 && !selectedLocation) {
            const first = userDevices[0];
            if (first.location) setSelectedLocation(first.location);
            else setSelectedLocation('Hanoi');
        } else if (!selectedLocation) setSelectedLocation('Hanoi');
    }, [userDevices, selectedLocation]);

    const hoursMap = { '1h': 1, '6h': 6, '12h': 12, '24h': 24 } as const;
    // Làm tròn theo phút để queryKey ổn định, tránh refetch liên tục mỗi render
    const [timeSlot, setTimeSlot] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setTimeSlot(Date.now()), 60 * 1000);
        return () => clearInterval(t);
    }, []);
    const { startTime, endTime } = useMemo(() => {
        const end = new Date();
        end.setSeconds(0, 0);
        end.setMilliseconds(0);
        const start = new Date(end.getTime() - hoursMap[timeRange] * 60 * 60 * 1000);
        return { startTime: start, endTime: end };
    }, [timeRange, timeSlot]);

    const { data: sensorRange = [] } = useQuery({
        queryKey: ['sensorRange', deviceIdForSensor, timeRange, startTime.toISOString(), endTime.toISOString()],
        queryFn: () =>
            sensorApi.getByDeviceIdAndTimeRange(
                deviceIdForSensor!,
                startTime.toISOString(),
                endTime.toISOString()
            ),
        enabled: !!deviceIdForSensor,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: sensorLatest } = useQuery({
        queryKey: ['sensorLatest', deviceIdForSensor],
        queryFn: () => sensorApi.getLatestByDeviceId(deviceIdForSensor!),
        enabled: !!deviceIdForSensor,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    const filteredData = useMemo((): MonitoringSensorData[] => {
        if (!sensorRange.length) return [];
        return sensorRange
            .slice()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((d) => ({
                time: new Date(d.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                soilMoisture: d.soilMoisture ?? 0,
                temperature: d.temperature ?? 0,
                humidity: d.humidity ?? 0,
                lightIntensity: d.lightIntensity ?? 0,
            }));
    }, [sensorRange]);

    const currentSensor = sensorLatest
        ? {
            soilMoisture: sensorLatest.soilMoisture ?? 0,
            temperature: sensorLatest.temperature ?? 0,
            humidity: sensorLatest.humidity ?? 0,
            lightIntensity: sensorLatest.lightIntensity ?? 0,
        }
        : { soilMoisture: 0, temperature: 0, humidity: 0, lightIntensity: 0 };

    const n = filteredData.length || 1;
    const avgSoil = (filteredData.reduce((s, d) => s + d.soilMoisture, 0) / n).toFixed(1);
    const avgTemp = (filteredData.reduce((s, d) => s + d.temperature, 0) / n).toFixed(1);
    const avgHumidity = (filteredData.reduce((s, d) => s + d.humidity, 0) / n).toFixed(1);
    const avgLight = Math.round(filteredData.reduce((s, d) => s + d.lightIntensity, 0) / n);

    return (
        <div className="space-y-6">
            {/* ============================================ */}
            {/* PAGE HEADER SECTION */}
            {/* ============================================ */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Giám sát</h1>
                        <p className="text-slate-500 mt-1">
                            Theo dõi dữ liệu cảm biến theo thời gian thực
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Real-time indicator */}
                        <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Real-time
                        </span>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                            Làm mới
                        </button>
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* TABS SECTION */}
            {/* ============================================ */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm">
                <Tabs.Root defaultValue="sensors">
                    <div className="mb-6 pb-4 border-b border-slate-200">
                        <Tabs.List className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                            <Tabs.Trigger
                                value="sensors"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            >
                                <Gauge className="w-4 h-4" />
                                Dữ liệu cảm biến
                            </Tabs.Trigger>
                            <Tabs.Trigger
                                value="weather"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            >
                                <CloudSun className="w-4 h-4" />
                                Dữ liệu thời tiết
                            </Tabs.Trigger>
                            <Tabs.Trigger
                                value="map"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            >
                                <MapPin className="w-4 h-4" />
                                Bản đồ
                            </Tabs.Trigger>
                        </Tabs.List>
                    </div>

                    {/* Tab Content: Sensors */}
                    <Tabs.Content value="sensors" className="space-y-6">
                        <div className="bg-white rounded-xl p-6 border border-slate-100">
                            {/* Time Range Selector */}
                            <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                            <Clock className="w-4 h-4 text-slate-400 ml-2" />
                            {Object.entries(timeRangeLabels).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setTimeRange(key as TimeRange)}
                                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === key
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                            </div>
                        </div>

                        {/* Section Header */}
                        <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-blue-50">
                            <Gauge className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Dữ liệu cảm biến</h2>
                            <p className="text-sm text-slate-500">Giá trị đo từ các cảm biến IoT trong vườn</p>
                        </div>
                        <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                            Real-time
                        </span>
                        </div>

                        {/* Current Sensor Values Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <SensorSummaryCard
                        title="Độ ẩm đất"
                        value={currentSensor.soilMoisture}
                        unit="%"
                        icon={<Droplets className="w-5 h-5 text-blue-500" />}
                        iconBg="bg-blue-50"
                    />
                    <SensorSummaryCard
                        title="Nhiệt độ (Cảm biến)"
                        value={currentSensor.temperature}
                        unit="°C"
                        icon={<Thermometer className="w-5 h-5 text-orange-500" />}
                        iconBg="bg-orange-50"
                    />
                    <SensorSummaryCard
                        title="Độ ẩm không khí (Cảm biến)"
                        value={currentSensor.humidity}
                        unit="%"
                        icon={<Wind className="w-5 h-5 text-cyan-500" />}
                        iconBg="bg-cyan-50"
                    />
                    <SensorSummaryCard
                        title="Cường độ ánh sáng"
                        value={currentSensor.lightIntensity.toLocaleString()}
                        unit="lux"
                        icon={<Sun className="w-5 h-5 text-yellow-500" />}
                        iconBg="bg-yellow-50"
                    />
                        </div>

                            {/* Sensor Averages Summary */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Activity className="w-5 h-5 text-teal-500" />
                                    <h3 className="font-semibold text-slate-700">Trung bình cảm biến trong {timeRangeLabels[timeRange]} qua</h3>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="text-center p-3 rounded-xl bg-blue-50/50">
                                        <p className="text-xs text-slate-400 mb-1">Độ ẩm đất</p>
                                        <p className="text-lg font-bold text-blue-600">{avgSoil}%</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-orange-50/50">
                                        <p className="text-xs text-slate-400 mb-1">Nhiệt độ</p>
                                        <p className="text-lg font-bold text-orange-600">{avgTemp}°C</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-cyan-50/50">
                                        <p className="text-xs text-slate-400 mb-1">Độ ẩm KK</p>
                                        <p className="text-lg font-bold text-cyan-600">{avgHumidity}%</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-yellow-50/50">
                                        <p className="text-xs text-slate-400 mb-1">Ánh sáng</p>
                                        <p className="text-lg font-bold text-yellow-600">{avgLight} lux</p>
                                    </div>
                                </div>
                            </div>

                        {/* Sensor Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <SensorChart
                        title="Độ ẩm đất"
                        data={filteredData}
                        dataKey="soilMoisture"
                        color="#3b82f6"
                        gradientId="soilGrad"
                        unit="%"
                        icon={<Droplets className="w-5 h-5 text-blue-500" />}
                    />
                    <SensorChart
                        title="Nhiệt độ (Cảm biến)"
                        data={filteredData}
                        dataKey="temperature"
                        color="#f97316"
                        gradientId="tempGrad"
                        unit="°C"
                        icon={<Thermometer className="w-5 h-5 text-orange-500" />}
                    />
                    <SensorChart
                        title="Độ ẩm không khí (Cảm biến)"
                        data={filteredData}
                        dataKey="humidity"
                        color="#06b6d4"
                        gradientId="humidGrad"
                        unit="%"
                        icon={<Wind className="w-5 h-5 text-cyan-500" />}
                    />
                    <SensorChart
                        title="Cường độ ánh sáng"
                        data={filteredData}
                        dataKey="lightIntensity"
                        color="#eab308"
                        gradientId="lightGrad"
                        unit="lux"
                        icon={<Sun className="w-5 h-5 text-yellow-500" />}
                    />
                    </div>
                        </div>
                    </Tabs.Content>

                    {/* Tab Content: Weather */}
                    <Tabs.Content value="weather" className="space-y-6">
                        <div className="bg-white rounded-xl p-6 border border-slate-100">
                            {/* Section Header with City Selector and Compact Weather Button */}
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-50">
                                        <CloudSun className="w-5 h-5 text-cyan-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">Dữ liệu thời tiết</h2>
                                        <p className="text-sm text-slate-500">Dự báo thời tiết từ OpenWeather cho địa điểm vườn</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* City Selector */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                                            <MapPin className="w-4 h-4" />
                                            Thành phố:
                                        </label>
                                        <Select.Root value={selectedCity} onValueChange={setSelectedCity}>
                                            <Select.Trigger className="inline-flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 min-w-[180px]">
                                                <Select.Value>
                                                    {VIETNAM_CITIES.find(c => c.value === selectedCity)?.name || selectedCity}
                                                </Select.Value>
                                                <Select.Icon>
                                                    <ChevronDown className="w-4 h-4" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Portal>
                                                <Select.Content className="overflow-hidden bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-[300px]">
                                                    <Select.Viewport className="p-1">
                                                        <Select.Group>
                                                            <Select.Label className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                                                                Thành phố Việt Nam
                                                            </Select.Label>
                                                            {VIETNAM_CITIES.map((city) => (
                                                                <Select.Item
                                                                    key={city.value}
                                                                    value={city.value}
                                                                    className="relative flex items-center px-3 py-2 text-sm text-slate-700 rounded-lg cursor-pointer hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none data-[highlighted]:bg-cyan-50"
                                                                >
                                                                    <Select.ItemText>{city.name}</Select.ItemText>
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Group>
                                                    </Select.Viewport>
                                                </Select.Content>
                                            </Select.Portal>
                                        </Select.Root>
                                    </div>
                                    {/* Compact Weather Management Button */}
                                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-slate-500" />
                                            <span className="text-sm font-medium text-slate-700">
                                                {loadingLocations ? (
                                                    <Loader2 className="w-4 h-4 animate-spin inline" />
                                                ) : (
                                                    `${locationCount} địa điểm`
                                                )}
                                            </span>
                                        </div>
                                        {isAdmin && (
                                            <>
                                                <div className="h-4 w-px bg-slate-200" />
                                                <button
                                                    onClick={() => fetchWeatherMutation.mutate()}
                                                    disabled={fetchWeatherMutation.isPending}
                                                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Cập nhật thời tiết ngay"
                                                >
                                                    {fetchWeatherMutation.isPending ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    )}
                                                    <span className="hidden sm:inline">Cập nhật</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Weather Forecast: theo vị trí thiết bị được chọn, fallback thành phố thủ công */}
                            <WeatherForecast
                                location={currentDevice?.location ?? selectedCity}
                            />
                            
                            {/* Demo Data Warning */}
                            {!selectedLocation && (
                                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <CloudSun className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-800">Đang hiển thị dữ liệu demo</p>
                                            <p className="text-xs text-amber-600 mt-1">
                                                Để xem dữ liệu thực tế, vui lòng thêm device với location trong trang Quản lý thiết bị.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Tabs.Content>

                    {/* Tab Content: Map */}
                    <Tabs.Content value="map" className="space-y-6">
                        <div className="bg-white rounded-xl p-6 border border-slate-100">
                            {/* Section Header */}
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                                <div className="p-2 rounded-lg bg-emerald-50">
                                    <MapPin className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Bản đồ thiết bị</h2>
                                    <p className="text-sm text-slate-500">Xem vị trí các thiết bị trên bản đồ</p>
                                </div>
                            </div>

                            {/* Map Component - đồng bộ thiết bị được chọn từ dropdown hoặc click marker */}
                            <DeviceMap
                                devices={
                                    userDevices.length > 0 && userDevices.some(d => d.latitude != null && d.longitude != null)
                                        ? userDevices
                                        : mockUserDevices
                                }
                                height="600px"
                                selectedDeviceId={selectedDeviceId}
                                onDeviceClick={(device) => {
                                    setSelectedDeviceId(device.id);
                                    toast.info(`Đã chọn thiết bị: ${device.deviceName}`);
                                }}
                            />
                            
                            {/* Demo Data Warning */}
                            {(userDevices.length === 0 || !userDevices.some(d => d.latitude != null && d.longitude != null)) && (
                                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-800">Đang hiển thị dữ liệu demo</p>
                                            <p className="text-xs text-amber-600 mt-1">
                                                Để xem dữ liệu thực tế, vui lòng thêm device với latitude và longitude trong trang Quản lý thiết bị.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Tabs.Content>
                </Tabs.Root>
            </div>
        </div>
    );
};
