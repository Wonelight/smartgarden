import React from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import type { SensorChartData, WaterUsageData } from '../../types/dashboard';

interface SensorLineChartProps {
    data: SensorChartData[];
    isLoading?: boolean;
}

export const SensorLineChart: React.FC<SensorLineChartProps> = ({ data, isLoading = false }) => {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Biểu đồ cảm biến</h3>
                    <p className="text-sm text-slate-500">Độ ẩm đất & ánh sáng theo thời gian</p>
                </div>
            </div>

            {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-pulse text-slate-400">Đang tải...</div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="soilGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="time"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: any, name: any) => {
                                if (value === undefined) return ['', name];
                                if (name === 'soilMoisture') return [`${value}%`, 'Độ ẩm đất'];
                                return [`${value.toLocaleString()} lux`, 'Ánh sáng'];
                            }}
                        />
                        <Legend
                            formatter={(value) => {
                                if (value === 'soilMoisture') return 'Độ ẩm đất (%)';
                                return 'Ánh sáng (lux)';
                            }}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="soilMoisture"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="lightIntensity"
                            stroke="#f59e0b"
                            strokeWidth={2.5}
                            dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

interface WaterUsageBarChartProps {
    data: WaterUsageData[];
    isLoading?: boolean;
}

export const WaterUsageBarChart: React.FC<WaterUsageBarChartProps> = ({ data, isLoading = false }) => {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Lượng nước sử dụng</h3>
                    <p className="text-sm text-slate-500">Thống kê theo ngày trong tuần</p>
                </div>
            </div>

            {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-pulse text-slate-400">Đang tải...</div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.9} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="day"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}L`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number | undefined) => value === undefined ? ['', 'Lượng nước'] : [`${value} lít`, 'Lượng nước']}
                            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Bar
                            dataKey="waterVolume"
                            fill="url(#waterGradient)"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={50}
                        />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};
