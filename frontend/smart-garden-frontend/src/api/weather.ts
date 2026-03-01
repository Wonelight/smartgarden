import { apiClient } from './client';
import type { ApiResponse } from '../types';

export interface WeatherData {
    id: number;
    location: string;
    temperature: number | null;
    humidity: number | null;
    precipitation: number | null;
    precipitationProbability: number | null;
    windSpeed: number | null;
    uvIndex: number | null;
    forecastTime: string;
    createdAt: string;
}

export interface DailyWeatherForecast {
    id: number;
    location: string;
    forecastDate: string;
    tempMin: number | null;
    tempMax: number | null;
    tempAvg: number | null;
    humidityAvg: number | null;
    windSpeedAvg: number | null;
    totalRain: number | null;
    precipProbAvg: number | null;
    avgClouds: number | null;
}

export const weatherApi = {
    // Lay danh sach cac dia diem duoc theo doi
    getMonitoredLocations: async (): Promise<Record<string, number>> => {
        const response = await apiClient.get<ApiResponse<Record<string, number>>>('/weather/locations');
        return response.data.data ?? {};
    },

    // Kich hoat fetch toan bo (Admin)
    fetchWeatherNow: async (): Promise<string> => {
        const response = await apiClient.post<ApiResponse<string>>('/weather/fetch-now');
        return response.data.data!;
    },

    // Kich hoat fetch cho 1 device
    fetchWeatherForDevice: async (deviceId: number): Promise<string> => {
        const response = await apiClient.post<ApiResponse<string>>(`/weather/device/${deviceId}/fetch`);
        return response.data.data!;
    },

    // Lay thoi tiet hien tai cho mot dia diem
    getCurrentWeather: async (location: string): Promise<WeatherData | null> => {
        const response = await apiClient.get<ApiResponse<WeatherData>>(`/weather/current/${encodeURIComponent(location)}`);
        return response.data.data;
    },

    // Lay du bao thoi tiet 5 ngay cho mot dia diem
    getWeatherForecast: async (location: string): Promise<DailyWeatherForecast[]> => {
        const response = await apiClient.get<ApiResponse<DailyWeatherForecast[]>>(`/weather/forecast/${encodeURIComponent(location)}`);
        return response.data.data ?? [];
    },
};
