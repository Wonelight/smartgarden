import React from 'react';
import { CloudSun, RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { weatherApi } from '../api/weather';
import { toast } from 'sonner';

export const WeatherWidget: React.FC<{ isAdmin?: boolean }> = ({ isAdmin }) => {
    const queryClient = useQueryClient();

    const { data: locations = {}, isLoading } = useQuery({
        queryKey: ['monitoredLocations'],
        queryFn: weatherApi.getMonitoredLocations,
        // Refetch every 5 minutes
        refetchInterval: 5 * 60 * 1000
    });

    const fetchNowMutation = useMutation({
        mutationFn: weatherApi.fetchWeatherNow,
        onSuccess: (msg) => {
            toast.success(msg);
            queryClient.invalidateQueries({ queryKey: ['monitoredLocations'] });
        },
        onError: () => toast.error('Lỗi khi cập nhật thời tiết')
    });

    const locationCount = Object.keys(locations).length;

    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5">
                <CloudSun className="w-32 h-32" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <CloudSun className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-700">Thời tiết</h3>
                    </div>

                    <p className="text-sm text-slate-500 mb-4">
                        Giám sát và cập nhật dữ liệu thời tiết cho
                        <span className="font-bold text-slate-700 mx-1">{locationCount}</span>
                        địa điểm.
                    </p>

                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Đang tải...
                            </div>
                        ) : locationCount > 0 ? (
                            Object.entries(locations).map(([loc, count], idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-slate-600 truncate max-w-[180px]" title={loc}>
                                        <MapPin className="w-3 h-3 flex-shrink-0 text-blue-400" />
                                        <span className="truncate">{loc}</span>
                                    </div>
                                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-mono">
                                        {count} dev
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic">Chưa có địa điểm nào được giám sát.</p>
                        )}
                    </div>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => fetchNowMutation.mutate()}
                        disabled={fetchNowMutation.isPending}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm font-medium transition-colors"
                    >
                        {fetchNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Cập nhật ngay
                    </button>
                )}
            </div>
        </div>
    );
};
