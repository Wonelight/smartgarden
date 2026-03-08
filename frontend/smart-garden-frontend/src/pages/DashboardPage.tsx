import React, { useState, useMemo, useCallback } from 'react';
import {
    RefreshCw, Loader2, Droplets, CloudRain, Power, Lightbulb,
    Gauge, TrendingUp, Target, Activity, Brain, CheckCircle2, History,
    Leaf, Thermometer, FlaskConical, Sun, CloudSun, MapPin, Sprout, Wind, Cpu
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
// (Local stat cards defined below – no imports needed from dashboard barrel)
import type { DeviceStatus, SensorData, IrrigationConfig } from '../types/dashboard';
import { deviceApi } from '../api/device';
import { sensorApi } from '../api/sensor';
import { irrigationApi } from '../api/irrigation';
import { waterBalanceApi } from '../api/waterBalance';
import { aiApi } from '../api/ai';
import { useDeviceSocket, type SensorEvent, type StatusEvent } from '../hooks/useDeviceSocket';
import { useMonitoringDevice } from '../contexts/MonitoringDeviceContext';

// ============================================
// FALLBACK DATA
// ============================================
const fallbackDevice: DeviceStatus = { id: 0, name: 'Chưa có thiết bị', status: 'OFFLINE', lastOnline: new Date().toISOString(), gpioPin: 0 };
const fallbackSensor: SensorData = { id: 0, deviceId: 0, soilMoisture: 0, temperature: 0, humidity: 0, lightIntensity: 0, timestamp: new Date().toISOString() };
const fallbackConfig: IrrigationConfig = { id: 0, deviceId: 0, autoMode: false, fuzzyEnabled: false, aiEnabled: false, soilMoistureMin: 30, soilMoistureMax: 70, wateringDuration: 30 };

// ============================================
// HELPER: build sensor chart data
// ============================================
const buildSensorChartData = (data: any[]) =>
    data.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        soilMoisture: d.soilMoisture ?? 0,
        lightIntensity: (d.lightIntensity ?? 0) / 100,
    }));

// ============================================
// EXTRA SENSOR CARD (Pump / Light / Rain)
// ============================================
const ExtraSensorCardLocal = ({
    pumpState, lightState, rainDetected, rainIntensity,
}: {
    pumpState: boolean; lightState: boolean; rainDetected: boolean;
    rainIntensity: number | null;
}) => {
    const rainText = rainDetected
        ? (rainIntensity != null
            ? (rainIntensity > 60 ? 'Mưa to' : rainIntensity > 20 ? 'Mưa vừa' : 'Mưa nhỏ')
            : 'Có mưa')
        : 'Không mưa';
    const rainColor = rainDetected ? 'text-blue-600 font-semibold' : 'text-slate-500 font-medium';
    const rainIconColor = rainDetected ? 'text-blue-500' : 'text-slate-400';

    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg bg-slate-50 border border-slate-200"><Cpu className="w-5 h-5 text-slate-500" /></div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full text-slate-600 bg-slate-50">Trạng thái</span>
            </div>
            <p className="text-sm font-medium text-slate-600 mb-3">Thiết bị & Môi trường</p>
            <div className="grid grid-cols-2 gap-2">
                {/* Pump */}
                <div className={`flex items-center gap-2 p-2 rounded-xl ${pumpState ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    <Power className={`w-4 h-4 ${pumpState ? 'text-blue-500' : 'text-slate-400'}`} />
                    <div>
                        <p className="text-xs text-slate-400">Máy bơm</p>
                        <p className={`text-sm font-semibold ${pumpState ? 'text-blue-600' : 'text-slate-500'}`}>{pumpState ? 'Đang bơm' : 'Tắt'}</p>
                    </div>
                </div>
                {/* Light */}
                <div className={`flex items-center gap-2 p-2 rounded-xl ${lightState ? 'bg-yellow-50' : 'bg-slate-50'}`}>
                    <Lightbulb className={`w-4 h-4 ${lightState ? 'text-yellow-500' : 'text-slate-400'}`} />
                    <div>
                        <p className="text-xs text-slate-400">Đèn</p>
                        <p className={`text-sm font-semibold ${lightState ? 'text-yellow-600' : 'text-slate-500'}`}>{lightState ? 'Bật' : 'Tắt'}</p>
                    </div>
                </div>
                {/* Rain */}
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 col-span-2">
                    <CloudRain className={`w-4 h-4 ${rainIconColor}`} />
                    <div>
                        <p className="text-xs text-slate-400">Cảm biến mưa</p>
                        <p className={`text-sm ${rainColor}`}>{rainText}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ENHANCED STAT CARD
// ============================================
const EnhancedStatCardLocal = ({ item }: { item: any }) => (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg" style={{ backgroundColor: item.bg, color: item.color }}>
                {item.icon}
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full text-slate-600 bg-slate-50">{item.trend}</span>
        </div>
        <div className="flex-grow flex flex-col justify-center my-2">
            {item.isSplit ? (
                <div className="flex flex-col gap-2 relative">
                    {/* Top: Shallow */}
                    <div className="flex justify-between items-end border-b border-slate-100 pb-1.5">
                        <div>
                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{item.top.sub}</p>
                            <h3 className="text-xl font-bold text-slate-700 leading-none mt-1">{item.top.value}</h3>
                        </div>
                    </div>
                    {/* Bottom: Deep */}
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{item.bottom.sub}</p>
                            <h3 className="text-xl font-bold text-slate-700 leading-none mt-1">{item.bottom.value}</h3>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <h3 className="text-2xl font-bold text-slate-700">{item.value}</h3>
                    <p className="text-sm font-medium text-slate-600 mt-1">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.sub}</p>
                </>
            )}
        </div>
        <div className="flex items-end gap-1 h-6 sm:h-8 mt-2 opacity-80">
            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all duration-300" style={{ height: `${h}%`, backgroundColor: i === 6 ? item.color : `${item.color}40` }} />
            ))}
        </div>
    </div>
);

// ============================================
// WEATHER WIDGET
// ============================================
const mockWeatherData = {
    weather: {
        current: { temp: 24, desc: 'Nhiều mây', feel: 25, icon: <CloudSun size={64} className="text-white drop-shadow-md" />, wind: 12, rain: 10, uv: 4 },
        forecast: [
            { day: 'Hôm nay', icon: <CloudSun className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />, hi: 26, lo: 21, rain: 20, suitable: true },
            { day: 'T3', icon: <CloudRain className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />, hi: 24, lo: 20, rain: 80, suitable: false },
            { day: 'T4', icon: <CloudRain className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />, hi: 23, lo: 19, rain: 90, suitable: false },
            { day: 'T5', icon: <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />, hi: 27, lo: 20, rain: 10, suitable: true },
            { day: 'T6', icon: <CloudSun className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />, hi: 28, lo: 21, rain: 30, suitable: true },
            { day: 'T7', icon: <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />, hi: 30, lo: 23, rain: 0, suitable: true },
            { day: 'CN', icon: <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />, hi: 31, lo: 24, rain: 0, suitable: true },
        ],
        tip: 'Độ ẩm đất đang khá tốt, dự báo có mưa sắp tới nên không cần tưới thêm nước thủ công trừ khi thật cần thiết.',
    }
};

const WeatherWidget = ({ sensorHumidity, rawDevice }: { sensorHumidity: number; rawDevice: any }) => {
    const data = mockWeatherData;
    const lat = rawDevice?.latitude || 21.0285;
    const lon = rawDevice?.longitude || 105.8542;
    const address = rawDevice?.address || 'Hà Nội';
    const offset = 0.015;
    const bbox = `${lon - offset},${lat - offset},${lon + offset},${lat + offset}`;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="relative h-48 overflow-hidden bg-slate-100 text-slate-700 flex flex-col justify-end p-5">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <iframe
                        src={mapUrl}
                        style={{ position: 'absolute', top: '-50px', left: '-50px', width: 'calc(100% + 100px)', height: 'calc(100% + 100px)', border: 0, pointerEvents: 'none', filter: 'saturate(1.1) contrast(1.05)', opacity: 0.7 }}
                        tabIndex={-1}
                        title="Vị trí thiết bị"
                    />
                </div>
                <div className="absolute inset-0 z-0 bg-slate-50/10" />
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-50/90 via-slate-50/40 to-transparent" />
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-slate-50/50 via-transparent to-transparent" />
                <div className="relative z-10 w-full mt-auto">
                    <div className="text-[11px] font-semibold text-emerald-700 mb-3 tracking-widest uppercase flex items-center gap-1.5 drop-shadow-sm">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate" title={address}>Thời Tiết Hôm Nay · {address}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-start gap-1 drop-shadow-sm">
                                <span className="text-6xl font-bold tracking-tight text-slate-700">{data.weather.current.temp}</span>
                                <span className="text-2xl font-semibold mt-1 text-slate-600">°C</span>
                            </div>
                            <div className="text-slate-600 mt-1 font-semibold text-lg drop-shadow-sm">{data.weather.current.desc}</div>
                            <div className="text-slate-500 font-semibold text-xs mt-0.5">Cảm giác như {data.weather.current.feel}°C</div>
                        </div>
                        <div className="mr-1">{data.weather.current.icon}</div>
                    </div>
                </div>
            </div>

            {/* Current Metrics */}
            <div className="flex justify-between items-center py-4 px-2 bg-white border-b border-slate-100 relative z-20">
                {[
                    { icon: <Wind className="w-5 h-5 text-slate-500" />, label: 'Gió', val: `${data.weather.current.wind} km/h` },
                    { icon: <CloudRain className="w-5 h-5 text-slate-500" />, label: 'Mưa', val: `${data.weather.current.rain}%` },
                    { icon: <Sun className="w-5 h-5 text-slate-500" />, label: 'UV', val: `${data.weather.current.uv}/10` },
                    { icon: <Droplets className="w-5 h-5 text-slate-500" />, label: 'Độ Ẩm', val: `${sensorHumidity.toFixed(1)}%` },
                ].map((m, i) => (
                    <div key={i} className={`flex-1 text-center ${i < 3 ? 'border-r border-slate-100' : ''}`}>
                        <div className="flex justify-center mb-1">{m.icon}</div>
                        <div className="text-[13px] font-medium text-slate-600 tracking-wide">{m.val}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* 7-day strip */}
            <div className="p-4 bg-white flex flex-col flex-1">
                <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Dự Báo 7 Ngày</div>
                <div className="grid grid-cols-7 gap-1.5 border-b border-slate-100 pb-4">
                    {data.weather.forecast.map((w, i) => (
                        <div key={i} className={`flex flex-col items-center p-1.5 rounded-xl transition-colors ${i === 0 ? 'bg-emerald-50 border border-emerald-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <div className={`text-[10px] font-semibold mb-1 uppercase tracking-widest leading-none ${i === 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{w.day}</div>
                            <div className="my-1">{w.icon}</div>
                            <div className="text-sm font-medium text-slate-600 leading-none mt-1">{w.hi}°</div>
                            <div className="text-xs text-slate-400 font-medium leading-none mt-0.5">{w.lo}°</div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 mb-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${w.rain > 60 ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${w.rain}%` }} />
                            </div>
                            <div className={`text-[10px] font-semibold leading-none ${w.rain > 60 ? 'text-blue-500' : 'text-slate-400'}`}>{w.rain}%</div>
                        </div>
                    ))}
                </div>
                <div className="mt-auto">
                    {/* Tip */}
                    <div className="flex items-start gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                        <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"><Sprout className="w-5 h-5 text-emerald-500" /></span>
                        <div className="text-[13px] text-slate-600 leading-relaxed pt-0.5">
                            <span className="font-semibold text-emerald-600">Gợi ý hôm nay: </span>{data.weather.tip}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FAO-56 QUICK STATS CARD
// ============================================
const Fao56OverviewCard = ({ deviceId }: { deviceId: number | null }) => {
    const { data: wb, isLoading } = useQuery({
        queryKey: ['waterBalanceState', deviceId],
        queryFn: () => waterBalanceApi.getWaterBalanceState(deviceId!),
        enabled: !!deviceId,
        refetchInterval: 60000,
    });

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-center min-h-[260px] animate-pulse">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Đang đồng bộ dữ liệu FAO-56 từ AI-Service...</p>
                </div>
            </div>
        );
    }

    if (!wb) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[260px]">
                <Droplets className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-500 font-semibold">Chưa có dữ liệu tính toán lượng nước (FAO-56)</p>
                <p className="text-sm text-slate-400 mt-1.5 max-w-sm text-center tracking-wide leading-relaxed">Hệ thống AI chưa hoàn tất tính toán hoặc thiết bị chưa gửi đủ dữ liệu môi trường để thiết lập mô hình.</p>
            </div>
        );
    }

    const maxRaw = Math.max(wb.totalRaw, 1);
    const depletionPct = Math.min((wb.weightedDepletion / maxRaw) * 100, 100);
    const isCritical = depletionPct >= 90;
    const isWarning = depletionPct >= 60 && depletionPct < 90;
    const statusColor = isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500';
    const bgStatusColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
    const fillGradientId = isCritical ? 'colorCritical' : isWarning ? 'colorWarning' : 'colorGood';
    const statusText = isCritical ? 'Cần tưới ngay' : isWarning ? 'Sắp cần tưới' : 'Độ ẩm tối ưu';

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-50/60 to-teal-50/60 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-[17px] font-bold text-slate-700 flex items-center gap-2 tracking-tight">
                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Gauge className="w-4 h-4" /></div>
                            Chỉ Số Water Balance (FAO-56)
                        </h3>
                        <p className="text-[13px] text-slate-500 mt-1.5 font-medium ml-8">Đánh giá lượng nước bốc hơi &amp; giữ lại trong đất bởi mô hình AI</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors ${isCritical ? 'bg-rose-50 text-rose-600 border border-rose-100' : isWarning ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        <span className="relative flex h-2 w-2">
                            {(isCritical || isWarning) && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCritical ? 'bg-rose-400' : 'bg-amber-400'} opacity-75`}></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${bgStatusColor}`}></span>
                        </span>
                        {statusText}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Circular Gauge */}
                    <div className="bg-gradient-to-b from-slate-50/50 to-slate-50/80 rounded-2xl p-5 border border-slate-100/80 flex flex-col items-center justify-center text-center shadow-inner hover:bg-slate-50 transition-colors">
                        <p className="text-[11px] font-semibold text-slate-500 mb-4 tracking-widest uppercase">Mức Thiếu Hụt Ẩm</p>
                        <div className="relative w-[130px] h-[130px] flex items-center justify-center mb-3">
                            <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                                <defs>
                                    <linearGradient id="colorCritical" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#e11d48" />
                                    </linearGradient>
                                    <linearGradient id="colorWarning" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#d97706" />
                                    </linearGradient>
                                    <linearGradient id="colorGood" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#059669" />
                                    </linearGradient>
                                </defs>
                                <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="8" fill="none" />
                                <circle
                                    cx="50" cy="50" r="40"
                                    stroke={`url(#${fillGradientId})`}
                                    className="transition-all duration-1000 ease-out"
                                    strokeWidth="8" fill="none" strokeLinecap="round"
                                    strokeDasharray="251.2"
                                    strokeDashoffset={`${251.2 - (251.2 * Math.max(depletionPct, 2)) / 100}`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="flex items-start">
                                    <span className={`text-4xl font-bold ${statusColor} tracking-tighter`}>{Math.round(depletionPct)}</span>
                                    <span className={`text-sm font-semibold mt-1 ml-0.5 ${statusColor}`}>%</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Depl. / RAW</p>
                    </div>

                    {/* Stats */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        {[
                            { icon: <Activity className="w-4 h-4 text-blue-500" />, label: 'Weighted Depl.', value: wb.weightedDepletion.toFixed(2), unit: 'mm', desc: 'Lượng nước đã bốc hơi mất', glow: 'from-blue-50/50 to-transparent' },
                            { icon: <Target className="w-4 h-4 text-purple-500" />, label: 'Total RAW', value: wb.totalRaw.toFixed(2), unit: 'mm', desc: 'Ngưỡng bốc hơi cho phép', glow: 'from-purple-50/50 to-transparent' },
                            { icon: <Droplets className="w-4 h-4 text-teal-500" />, label: 'Total TAW', value: wb.totalTaw.toFixed(2), unit: 'mm', desc: 'Tổng lượng ẩm sẵn sàng', glow: 'from-teal-50/50 to-transparent' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group/card">
                                <div className={`absolute right-0 top-0 h-full w-12 bg-gradient-to-l ${stat.glow} to-transparent pointer-events-none group-hover/card:w-20 transition-all duration-300`}></div>
                                <div className="flex items-center gap-2 mb-2">{stat.icon}<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{stat.label}</span></div>
                                <div className="mt-2.5 flex items-baseline">
                                    <span className="text-[26px] font-black text-slate-700 tracking-tight">{stat.value}</span>
                                    <span className="text-sm font-semibold text-slate-400 ml-1.5">{stat.unit}</span>
                                </div>
                                <p className="text-[11px] font-medium text-slate-400 mt-1">{stat.desc}</p>
                            </div>
                        ))}
                        {/* Irrigation + Trend */}
                        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group/card">
                            <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-orange-50/50 to-transparent pointer-events-none group-hover/card:w-20 transition-all duration-300"></div>
                            <div className="flex items-center gap-2 mb-2"><CloudRain className="w-4 h-4 text-orange-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tưới Cuối</span></div>
                            <div className="mt-2.5 flex items-baseline justify-between">
                                <div>
                                    <span className="text-[26px] font-black text-slate-700 tracking-tight">{wb.lastIrrigation.toFixed(1)}</span>
                                    <span className="text-sm font-semibold text-slate-400 ml-1.5">mm</span>
                                </div>
                                {wb.soilMoisTrend != null && (
                                    <div className={`flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-md ${wb.soilMoisTrend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {wb.soilMoisTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                                        <span className="text-[10px] font-semibold">{Math.abs(wb.soilMoisTrend).toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] font-medium text-slate-400 mt-1">Ghi nhận tưới cuối ngày</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ============================================
// ML PREDICTION QUICK STATS CARD
// ============================================
const MLPredictionOverviewCard = ({ deviceId, gardenArea }: { deviceId: number | null, gardenArea?: number }) => {
    const { data: historyResults, isLoading, error } = useQuery({
        queryKey: ['aiHistory', deviceId],
        queryFn: () => aiApi.getHistory(deviceId!),
        enabled: !!deviceId,
        refetchInterval: 60000,
    });

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-center min-h-[200px] animate-pulse">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Đang tải dữ liệu dự báo AI...</p>
                </div>
            </div>
        );
    }

    const latestResult = historyResults && historyResults.length > 0 ? historyResults[0] : null;

    if (!latestResult || error) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[200px]">
                <Brain className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-500 font-semibold">Chưa có dữ liệu dự báo ML/AI</p>
                <p className="text-sm text-slate-400 mt-1.5 max-w-sm text-center tracking-wide leading-relaxed">Hệ thống chưa ghi nhận lần dự báo nào cho thiết bị này. Vui lòng kiểm tra lại cấu hình hoặc chờ chu kì dự báo tiếp theo.</p>
            </div>
        );
    }

    const confidence = latestResult.modelAccuracy ?? latestResult.aiAccuracy ?? 0;
    const isHighConfidence = confidence >= 0.8;
    const isMediumConfidence = confidence >= 0.5 && confidence < 0.8;
    const confidenceColor = isHighConfidence ? 'text-emerald-500' : isMediumConfidence ? 'text-amber-500' : 'text-rose-500';

    // Tính toán thời gian bơm theo diện tích vườn và lượng nước (mm = L/m2)
    const areaM2 = gardenArea || 100; // Mặc định 100m2 nếu chưa cấu hình
    const waterMm = latestResult.predictedWaterAmount ?? 0;
    const totalWaterLiters = waterMm * areaM2;
    // Giả sử công suất bơm trung bình là 5 m3/h (5000 L/h) đối với hệ thống vườn thông thường
    const pumpCapacityLpH = 5000;
    const calculatedDurationSeconds = Math.round((totalWaterLiters / pumpCapacityLpH) * 3600);

    const h = Math.floor(calculatedDurationSeconds / 3600);
    const m = Math.floor((calculatedDurationSeconds % 3600) / 60);
    const s = calculatedDurationSeconds % 60;
    let formattedDuration = `${s}s`;
    if (h > 0) formattedDuration = `${h}h ${m}m ${s}s`;
    else if (m > 0) formattedDuration = `${m}m ${s}s`;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-50/60 to-indigo-50/60 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-[17px] font-bold text-slate-700 flex items-center gap-2 tracking-tight">
                            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600"><Brain className="w-4 h-4" /></div>
                            Kết Quả Dự Báo Gần Nhất (Machine Learning)
                        </h3>
                        <p className="text-[13px] text-slate-500 mt-1.5 font-medium ml-8">Dựa trên diện tích: {areaM2.toLocaleString('vi-VN')} m²</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <History className="w-3.5 h-3.5" />
                        {new Date(latestResult.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Water Amount */}
                    <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 rounded-xl p-4 border border-blue-100/50 flex flex-col">
                        <div className="flex items-center gap-2 mb-3"><Droplets className="w-4 h-4 text-blue-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lượng Nước</span></div>
                        <div className="mt-auto">
                            <div className="flex items-baseline mb-1">
                                <span className="text-3xl font-bold text-slate-700 tracking-tighter">{(latestResult.predictedWaterAmount ?? 0).toFixed(1)}</span>
                                <span className="text-sm font-semibold text-slate-500 ml-1">mm</span>
                            </div>
                            <div className="text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded w-fit">
                                ~ {Math.round(totalWaterLiters).toLocaleString('vi-VN')} Lít
                            </div>
                        </div>
                    </div>
                    {/* Confidence */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200/50 flex flex-col">
                        <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-slate-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Độ Tin Cậy</span></div>
                        <div className="mt-auto">
                            <div className="flex items-baseline">
                                <span className={`text-3xl font-bold tracking-tighter ${confidenceColor}`}>{Math.round(confidence * 100)}</span>
                                <span className={`text-sm font-semibold ml-1 ${confidenceColor}`}>%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${isHighConfidence ? 'bg-emerald-500' : isMediumConfidence ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.round(confidence * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                    {/* Duration */}
                    <div className="bg-gradient-to-br from-purple-50/50 to-fuchsia-50/50 rounded-xl p-4 border border-purple-100/50 flex flex-col">
                        <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-purple-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Thời Gian Bơm</span></div>
                        <div className="mt-auto">
                            <div className="flex items-baseline">
                                <span className="text-2xl font-bold text-slate-700 tracking-tight">{waterMm > 0 ? formattedDuration : '—'}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-100 text-purple-700">{latestResult.predictionType ?? 'WATER_NEED'}</span>
                            </div>
                        </div>
                    </div>
                    {/* Model version */}
                    <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-xl p-4 border border-emerald-100/50 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Version Model</span></div>
                        <div className="mt-auto">
                            <span className="text-sm font-semibold text-slate-700 font-mono tracking-tight break-all block">
                                {(latestResult.aiParams as Record<string, unknown> | undefined)?.model as string ?? 'Mặc định'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// DASHBOARD PAGE COMPONENT
// ============================================

export const DashboardPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ---- Devices ----
    const { data: devices = [] } = useQuery({
        queryKey: ['myDevices'],
        queryFn: deviceApi.getMyDevices,
    });

    const { selectedDeviceId: deviceId } = useMonitoringDevice();
    const currentDeviceCode = devices.find(d => d.id === deviceId)?.deviceCode ?? null;

    // ---- WebSocket ----
    const [liveSensor, setLiveSensor] = useState<SensorEvent | null>(null);

    const handleSensorData = useCallback((data: SensorEvent) => { setLiveSensor(data); }, []);
    const handleStatusChange = useCallback((data: StatusEvent) => {
        console.log('[Dashboard] Status change:', data);
        setLiveSensor(prev => {
            if (prev) return { ...prev, pumpState: data.pumpState ?? prev.pumpState, lightState: data.lightState ?? prev.lightState };
            return { pumpState: data.pumpState, lightState: data.lightState } as SensorEvent;
        });
    }, []);

    const { isConnected: wsConnected } = useDeviceSocket({
        deviceCode: currentDeviceCode,
        onSensorData: handleSensorData,
        onStatusChange: handleStatusChange,
        enabled: !!deviceId,
        wsUrl: 'ws://localhost:8081/api/ws',
    });

    // ---- Sensor Latest ----
    const { data: sensorDetail, isLoading: loadingSensor } = useQuery({
        queryKey: ['sensorLatest', deviceId],
        queryFn: () => sensorApi.getLatestByDeviceId(deviceId!),
        enabled: !!deviceId,
        refetchInterval: wsConnected ? 30000 : 10000,
    });

    // ---- Sensor Range (24h) ----
    const timeWindow = useMemo(() => {
        const end = new Date(); end.setSeconds(0, 0);
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return { start: start.toISOString(), end: end.toISOString() };
    }, [Math.floor(Date.now() / 60000)]);

    const { data: sensorRange = [] } = useQuery({
        queryKey: ['sensorRange24h', deviceId, timeWindow.start],
        queryFn: () => sensorApi.getByDeviceIdAndTimeRange(deviceId!, timeWindow.start, timeWindow.end),
        enabled: !!deviceId,
        staleTime: 60000,
    });

    // ---- Irrigation Config ----
    const { data: irrigationConfig, isLoading: loadingConfig } = useQuery({
        queryKey: ['irrigationConfig', deviceId],
        queryFn: () => irrigationApi.getConfigByDeviceId(deviceId!),
        enabled: !!deviceId,
    });

    // ---- Refresh ----
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['myDevices'] }),
            queryClient.invalidateQueries({ queryKey: ['sensorLatest', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['sensorRange24h', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['irrigationConfig', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['waterBalanceState', deviceId] }),
            queryClient.invalidateQueries({ queryKey: ['aiHistory', deviceId] }),
        ]);
        setIsRefreshing(false);
    };

    // ---- Map data ----
    const currentDevice = devices.find(d => d.id === deviceId);
    const device: DeviceStatus = deviceId && currentDevice
        ? { id: currentDevice.id, name: currentDevice.deviceName, status: currentDevice.status === 'ERROR' ? 'OFFLINE' : currentDevice.status, lastOnline: currentDevice.lastOnline ?? new Date().toISOString(), gpioPin: 0 }
        : fallbackDevice;

    const sensor: SensorData = sensorDetail
        ? { id: sensorDetail.id, deviceId: sensorDetail.deviceId, soilMoisture: liveSensor?.soilMoisture ?? sensorDetail.soilMoisture ?? 0, temperature: liveSensor?.temperature ?? sensorDetail.temperature ?? 0, humidity: liveSensor?.humidity ?? sensorDetail.humidity ?? 0, lightIntensity: liveSensor?.lightIntensity ?? sensorDetail.lightIntensity ?? 0, timestamp: sensorDetail.timestamp }
        : fallbackSensor;

    const config: IrrigationConfig = irrigationConfig
        ? { id: irrigationConfig.id, deviceId: irrigationConfig.deviceId, autoMode: irrigationConfig.autoMode ?? false, fuzzyEnabled: irrigationConfig.fuzzyEnabled ?? false, aiEnabled: irrigationConfig.aiEnabled ?? false, soilMoistureMin: irrigationConfig.soilMoistureMin ?? 30, soilMoistureMax: irrigationConfig.soilMoistureMax ?? 70, wateringDuration: irrigationConfig.irrigationDurationMax ?? irrigationConfig.irrigationDurationMin ?? 30 }
        : fallbackConfig;

    const loading = loadingSensor || loadingConfig;
    const sensorMoisture2 = liveSensor?.soilMoisture2 ?? (sensorDetail as any)?.soilMoisture2 ?? 0;

    // ---- Stat Metrics ----
    const METRICS = [
        { label: 'Sức khỏe thiết bị', value: device.status === 'ONLINE' ? 'Kết nối' : 'Mất kết nối', sub: `Tên: ${device.name}`, icon: <Leaf className="w-6 h-6" />, color: device.status === 'ONLINE' ? '#10B981' : '#EF4444', bg: device.status === 'ONLINE' ? '#ECFDF5' : '#FEF2F2', trend: device.status === 'ONLINE' ? 'Online' : 'Offline' },
        { label: 'Nhiệt độ', value: `${sensor.temperature.toFixed(1)}°C`, sub: 'Nhiệt độ không khí', icon: <Thermometer className="w-6 h-6" />, color: '#F59E0B', bg: '#FFFBEB', trend: sensor.temperature > 35 ? 'Nóng' : 'Ổn định' },
        { isSplit: true, top: { sub: 'Đất (nông)', value: `${sensor.soilMoisture.toFixed(1)}%` }, bottom: { sub: 'Đất (sâu)', value: `${sensorMoisture2.toFixed(1)}%` }, label: 'Độ ẩm đất', value: `${sensor.soilMoisture.toFixed(1)}%`, sub: `Ngưỡng: ${config.soilMoistureMin}% – ${config.soilMoistureMax}%`, icon: <FlaskConical className="w-6 h-6" />, color: '#8B5CF6', bg: '#F5F3FF', trend: sensor.soilMoisture < config.soilMoistureMin ? 'Cần tưới' : 'Ổn định' },
        { label: 'Độ ẩm không khí', value: `${sensor.humidity.toFixed(1)}%`, sub: 'Độ ẩm môi trường', icon: <Droplets className="w-6 h-6" />, color: '#0EA5E9', bg: '#F0F9FF', trend: 'Bình thường' },
        { label: 'Ánh sáng', value: `${Math.round(sensor.lightIntensity)} lux`, sub: 'Cường độ sáng', icon: <Sun className="w-6 h-6" />, color: '#EAB308', bg: '#FEFCE8', trend: sensor.lightIntensity > 5000 ? 'Nắng gắt' : 'Vừa phải' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-slate-700">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Giám sát và điều khiển hệ thống tưới tiêu thông minh</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                    >
                        {isRefreshing || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Row 1: Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {METRICS.map((m, i) => (
                    <EnhancedStatCardLocal key={i} item={m} />
                ))}
                <ExtraSensorCardLocal
                    pumpState={liveSensor?.pumpState ?? (sensorDetail as any)?.pumpState ?? false}
                    lightState={liveSensor?.lightState ?? (sensorDetail as any)?.lightState ?? false}
                    rainDetected={liveSensor?.rainDetected ?? (sensorDetail as any)?.rainDetected ?? false}
                    rainIntensity={liveSensor?.rainIntensity ?? (sensorDetail as any)?.rainIntensity ?? null}
                />
            </div>

            {/* Row 2: ML Prediction + FAO-56 + Weather */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6 flex flex-col">
                    <MLPredictionOverviewCard deviceId={deviceId || null} gardenArea={currentDevice?.gardenArea} />
                    <div className="flex-1">
                        <Fao56OverviewCard deviceId={deviceId || null} />
                    </div>
                </div>
                <div>
                    <WeatherWidget sensorHumidity={sensor.humidity} rawDevice={devices[0]} />
                </div>
            </div>
        </div>
    );
};
