import React, { useState, useEffect } from 'react';
import {
    CloudSun, CloudRain, Sun, Cloud, Wind, Droplets, Thermometer,
    MapPin, Calendar, X
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { weatherApi, type DailyWeatherForecast, type WeatherData } from '../api/weather';
import { SkeletonCard } from './ui/Skeleton';
import {
    mockCurrentWeatherByLocation,
    mockWeatherForecastByLocation,
    mockCurrentWeather,
    mockWeatherForecast,
} from '../mocks/smartGardenMocks';

// ============================================
// WEATHER ICON HELPER
// ============================================

const getWeatherIcon = (forecast: DailyWeatherForecast): React.ReactNode => {
    const rain = forecast.totalRain ?? 0;
    const clouds = forecast.avgClouds ?? 0;
    const precipProb = forecast.precipProbAvg ?? 0;

    if (rain > 5 || precipProb > 60) {
        return <CloudRain className="w-8 h-8 text-blue-500" />;
    } else if (clouds > 50) {
        return <Cloud className="w-8 h-8 text-slate-400" />;
    } else if (clouds > 20) {
        return <CloudSun className="w-8 h-8 text-yellow-500" />;
    } else {
        return <Sun className="w-8 h-8 text-yellow-400" />;
    }
};

const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Hôm nay';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Ngày mai';
    } else {
        return date.toLocaleDateString('vi-VN', { weekday: 'long' });
    }
};

// ============================================
// FORECAST DETAIL MODAL
// ============================================

const ForecastDetailModal: React.FC<{
    forecast: DailyWeatherForecast | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}> = ({ forecast, open, onOpenChange }) => {
    if (!forecast) return null;

    const dayName = getDayName(forecast.forecastDate);
    const date = new Date(forecast.forecastDate).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in-95">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                            {getWeatherIcon(forecast)}
                            <div>
                                <Dialog.Title className="text-2xl font-bold text-slate-800">{dayName}</Dialog.Title>
                                <p className="text-sm text-slate-500 mt-1">{date}</p>
                            </div>
                        </div>
                        <Dialog.Close asChild>
                            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Temperature */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Thermometer className="w-5 h-5 text-orange-600" />
                                <span className="text-sm font-medium text-orange-700">Nhiệt độ</span>
                            </div>
                            {forecast.tempMin != null && forecast.tempMax != null ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-orange-800">{Math.round(forecast.tempMax)}°</span>
                                    <span className="text-lg text-orange-600">/ {Math.round(forecast.tempMin)}°</span>
                                </div>
                            ) : (
                                <span className="text-lg text-orange-600">—</span>
                            )}
                            {forecast.tempAvg != null && (
                                <p className="text-xs text-orange-600 mt-1">Trung bình: {Math.round(forecast.tempAvg)}°C</p>
                            )}
                        </div>

                        {/* Humidity */}
                        {forecast.humidityAvg != null && (
                            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Droplets className="w-5 h-5 text-cyan-600" />
                                    <span className="text-sm font-medium text-cyan-700">Độ ẩm</span>
                                </div>
                                <span className="text-3xl font-bold text-cyan-800">{Math.round(forecast.humidityAvg)}%</span>
                            </div>
                        )}

                        {/* Rain */}
                        {forecast.totalRain != null && forecast.totalRain > 0 && (
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Droplets className="w-5 h-5 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Lượng mưa</span>
                                </div>
                                <span className="text-3xl font-bold text-blue-800">{forecast.totalRain.toFixed(1)}</span>
                                <span className="text-lg text-blue-600 ml-1">mm</span>
                            </div>
                        )}

                        {/* Precipitation Probability */}
                        {forecast.precipProbAvg != null && (
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CloudRain className="w-5 h-5 text-slate-600" />
                                    <span className="text-sm font-medium text-slate-700">Khả năng mưa</span>
                                </div>
                                <span className="text-3xl font-bold text-slate-800">{Math.round(forecast.precipProbAvg * 100)}%</span>
                            </div>
                        )}

                        {/* Wind */}
                        {forecast.windSpeedAvg != null && (
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wind className="w-5 h-5 text-slate-600" />
                                    <span className="text-sm font-medium text-slate-700">Tốc độ gió</span>
                                </div>
                                <span className="text-3xl font-bold text-slate-800">{forecast.windSpeedAvg.toFixed(1)}</span>
                                <span className="text-lg text-slate-600 ml-1">m/s</span>
                            </div>
                        )}

                        {/* Clouds */}
                        {forecast.avgClouds != null && (
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Cloud className="w-5 h-5 text-slate-600" />
                                    <span className="text-sm font-medium text-slate-700">Mây che phủ</span>
                                </div>
                                <span className="text-3xl font-bold text-slate-800">{Math.round(forecast.avgClouds)}%</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            Thành phố: {forecast.location}
                        </p>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

// ============================================
// FORECAST CARD COMPONENT
// ============================================

const ForecastCard: React.FC<{
    forecast: DailyWeatherForecast;
    onClick: () => void;
}> = ({ forecast, onClick }) => {
    const dayName = getDayName(forecast.forecastDate);
    const date = new Date(forecast.forecastDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-sm font-semibold text-slate-800">{dayName}</p>
                    <p className="text-xs text-slate-400">{date}</p>
                </div>
                {getWeatherIcon(forecast)}
            </div>

            <div className="space-y-2">
                {/* Temperature */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-slate-500">Nhiệt độ</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        {forecast.tempMin != null && forecast.tempMax != null ? (
                            <>
                                <span className="text-sm font-medium text-slate-600">{Math.round(forecast.tempMin)}°</span>
                                <span className="text-xs text-slate-400">/</span>
                                <span className="text-sm font-bold text-slate-800">{Math.round(forecast.tempMax)}°</span>
                            </>
                        ) : (
                            <span className="text-xs text-slate-400">—</span>
                        )}
                    </div>
                </div>

                {/* Rain */}
                {(forecast.totalRain != null && forecast.totalRain > 0) && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Droplets className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500">Mưa</span>
                        </div>
                        <span className="text-sm font-medium text-blue-600">{forecast.totalRain.toFixed(1)} mm</span>
                    </div>
                )}

                {/* Precipitation Probability */}
                {forecast.precipProbAvg != null && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <CloudRain className="w-4 h-4 text-slate-400" />
                            <span className="text-xs text-slate-500">Khả năng mưa</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600">{Math.round(forecast.precipProbAvg * 100)}%</span>
                    </div>
                )}

                {/* Wind */}
                {forecast.windSpeedAvg != null && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Wind className="w-4 h-4 text-slate-400" />
                            <span className="text-xs text-slate-500">Gió</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600">{forecast.windSpeedAvg.toFixed(1)} m/s</span>
                    </div>
                )}

                {/* Humidity */}
                {forecast.humidityAvg != null && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Droplets className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500">Độ ẩm</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600">{Math.round(forecast.humidityAvg)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// CURRENT WEATHER CARD
// ============================================

const CurrentWeatherCard: React.FC<{ weather: WeatherData }> = ({ weather }) => {
    const getCurrentIcon = () => {
        const precip = weather.precipitation ?? 0;
        const precipProb = weather.precipitationProbability ?? 0;
        if (precip > 0 || precipProb > 60) {
            return <CloudRain className="w-12 h-12 text-blue-500" />;
        }
        return <CloudSun className="w-12 h-12 text-yellow-500" />;
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">{weather.location}</span>
                    </div>
                    <p className="text-xs text-blue-500">
                        {new Date(weather.forecastTime).toLocaleString('vi-VN', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                </div>
                {getCurrentIcon()}
            </div>

            <div className="space-y-3">
                {weather.temperature != null && (
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-slate-800">{Math.round(weather.temperature)}</span>
                        <span className="text-xl text-slate-600">°C</span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-100">
                    {weather.humidity != null && (
                        <div>
                            <p className="text-xs text-blue-600 mb-1">Độ ẩm</p>
                            <p className="text-lg font-semibold text-slate-800">{Math.round(weather.humidity)}%</p>
                        </div>
                    )}
                    {weather.windSpeed != null && (
                        <div>
                            <p className="text-xs text-blue-600 mb-1">Gió</p>
                            <p className="text-lg font-semibold text-slate-800">{weather.windSpeed.toFixed(1)} m/s</p>
                        </div>
                    )}
                    {weather.precipitation != null && weather.precipitation > 0 && (
                        <div>
                            <p className="text-xs text-blue-600 mb-1">Mưa</p>
                            <p className="text-lg font-semibold text-slate-800">{weather.precipitation.toFixed(1)} mm</p>
                        </div>
                    )}
                    {weather.uvIndex != null && (
                        <div>
                            <p className="text-xs text-blue-600 mb-1">UV Index</p>
                            <p className="text-lg font-semibold text-slate-800">{weather.uvIndex.toFixed(1)}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// VIETNAM CITIES FOR OPENWEATHER
// ============================================

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

// Map device location to nearest city (for demo purposes)
const mapDeviceLocationToCity = (deviceLocation: string): string => {
    const lowerLocation = deviceLocation.toLowerCase();
    if (lowerLocation.includes('hà nội') || lowerLocation.includes('hanoi')) return 'Hanoi';
    if (lowerLocation.includes('hồ chí minh') || lowerLocation.includes('ho chi minh') || lowerLocation.includes('tp.hcm')) return 'Ho Chi Minh City';
    if (lowerLocation.includes('đà nẵng') || lowerLocation.includes('da nang')) return 'Da Nang';
    if (lowerLocation.includes('hải phòng') || lowerLocation.includes('hai phong')) return 'Hai Phong';
    if (lowerLocation.includes('cần thơ') || lowerLocation.includes('can tho')) return 'Can Tho';
    // Default to Hanoi if no match
    return 'Hanoi';
};

// ============================================
// WEATHER FORECAST COMPONENT
// ============================================

interface WeatherForecastProps {
    location: string;
    className?: string;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({ location, className = '' }) => {
    // Use default city if no location provided
    const defaultCity = 'Hanoi';
    const [currentCity, setCurrentCity] = useState<string>(() => {
        // Map device location to city, or use default
        if (location) {
            return mapDeviceLocationToCity(location);
        }
        return defaultCity;
    });
    const [selectedForecast, setSelectedForecast] = useState<DailyWeatherForecast | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch current weather using city name
    const { data: currentWeather, isLoading: loadingCurrent, isError: errorCurrent } = useQuery({
        queryKey: ['currentWeather', currentCity],
        queryFn: () => weatherApi.getCurrentWeather(currentCity),
        enabled: !!currentCity,
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
        retry: false,
    });

    // Fetch forecast using city name
    const { data: forecast = [], isLoading: loadingForecast, isError: errorForecast } = useQuery({
        queryKey: ['weatherForecast', currentCity],
        queryFn: () => weatherApi.getWeatherForecast(currentCity),
        enabled: !!currentCity,
        refetchInterval: 60 * 60 * 1000, // Refetch every hour
        retry: false,
    });

    useEffect(() => {
        if (location) {
            const mappedCity = mapDeviceLocationToCity(location);
            setCurrentCity(mappedCity);
        } else if (!currentCity) {
            setCurrentCity(defaultCity);
        }
    }, [location, currentCity]);

    const handleForecastClick = (forecast: DailyWeatherForecast) => {
        setSelectedForecast(forecast);
        setIsModalOpen(true);
    };

    // Get city display name
    const cityDisplayName = VIETNAM_CITIES.find(c => c.value === currentCity)?.name || currentCity;

    // Use mock data as fallback (always show demo data)
    const displayCurrentWeather: WeatherData | null = currentWeather 
        ?? mockCurrentWeatherByLocation[cityDisplayName] 
        ?? { ...mockCurrentWeather, location: cityDisplayName };

    const displayForecast: DailyWeatherForecast[] = forecast.length > 0 
        ? forecast.map(f => ({ ...f, location: cityDisplayName }))
        : (mockWeatherForecastByLocation[cityDisplayName] ?? mockWeatherForecast.map(f => ({ ...f, location: cityDisplayName })));

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Current Weather */}
            {loadingCurrent ? (
                <SkeletonCard />
            ) : displayCurrentWeather ? (
                <CurrentWeatherCard weather={displayCurrentWeather} />
            ) : (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-500 text-center">Chưa có dữ liệu thời tiết hiện tại</p>
                </div>
            )}

            {/* Forecast */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-teal-500" />
                    <h3 className="font-semibold text-slate-700">Dự báo 5 ngày</h3>
                    {(errorForecast || errorCurrent) && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full ml-auto">
                            Đang dùng dữ liệu mẫu
                        </span>
                    )}
                </div>

                {loadingForecast ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : displayForecast.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {displayForecast.map((f) => (
                            <ForecastCard key={f.id} forecast={f} onClick={() => handleForecastClick(f)} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl p-6 border border-slate-100 text-center">
                        <CloudSun className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Chưa có dữ liệu dự báo</p>
                    </div>
                )}
            </div>

            {/* Forecast Detail Modal */}
            <ForecastDetailModal
                forecast={selectedForecast}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
            />
        </div>
    );
};
