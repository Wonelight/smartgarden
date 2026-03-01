/**
 * Centralized mock data for Smart Garden pages.
 * All data uses Vietnamese locale and realistic values.
 */
import type {
    SensorData,
    DeviceStatus,
    IrrigationConfig,
    IrrigationHistory,
    MLPrediction,
    Schedule,
    MonitoringSensorData,
    FuzzyLogicResult,
    ScheduleDetail,
    MLPredictionDetail,
    IrrigationHistoryStatus,
} from '../types/dashboard';
import type {
    UserDeviceListItem,
    AdminDeviceListItem,
} from '../api/device';
import type { WaterBalanceStateResponse, DailyWaterBalanceResponse } from '../api/waterBalance';
import type { WeatherData, DailyWeatherForecast } from '../api/weather';

// ============================================
// DEVICES
// ============================================

export const mockUserDevices: UserDeviceListItem[] = [
    {
        id: 1,
        deviceName: 'ESP32-Garden-01',
        deviceCode: 'SG-ESP32-001',
        location: 'Vườn rau sân thượng',
        latitude: 21.0285,
        longitude: 105.8542,
        altitude: 15.5,
        status: 'ONLINE',
        lastOnline: '2026-02-15T09:40:00+07:00',
        gardenBounds: {
            north: 21.0295,
            south: 21.0275,
            east: 105.8552,
            west: 105.8532,
        },
        gardenArea: 10000, // 100m x 100m = 10,000 m²
    },
    {
        id: 2,
        deviceName: 'ESP32-Garden-02',
        deviceCode: 'SG-ESP32-002',
        location: 'Vườn hoa ban công',
        latitude: 10.8231,
        longitude: 106.6297,
        altitude: 8.2,
        status: 'OFFLINE',
        lastOnline: '2026-02-14T18:22:00+07:00',
        gardenBounds: {
            north: 10.8241,
            south: 10.8221,
            east: 106.6307,
            west: 106.6287,
        },
        gardenArea: 8000, // 80m x 100m = 8,000 m²
    },
    {
        id: 3,
        deviceName: 'ESP32-Greenhouse',
        deviceCode: 'SG-ESP32-003',
        location: 'Nhà kính',
        latitude: 16.0544,
        longitude: 108.2022,
        altitude: 12.0,
        status: 'ONLINE',
        lastOnline: '2026-02-15T09:38:00+07:00',
        gardenBounds: {
            north: 16.0554,
            south: 16.0534,
            east: 108.2032,
            west: 108.2012,
        },
        gardenArea: 15000, // 150m x 100m = 15,000 m²
    },
];

export const mockAdminDevices: AdminDeviceListItem[] = [
    {
        id: 1,
        deviceCode: 'SG-ESP32-001',
        deviceName: 'ESP32-Garden-01',
        location: 'Vườn rau sân thượng',
        latitude: 21.0285,
        longitude: 105.8542,
        altitude: 15.5,
        status: 'ONLINE',
        firmwareVersion: 'v2.1.0',
        lastOnline: '2026-02-15T09:40:00+07:00',
        userId: 1,
        username: 'nguyenvana',
    },
    {
        id: 2,
        deviceCode: 'SG-ESP32-002',
        deviceName: 'ESP32-Garden-02',
        location: 'Vườn hoa ban công',
        latitude: 10.8231,
        longitude: 106.6297,
        altitude: 8.2,
        status: 'OFFLINE',
        firmwareVersion: 'v2.0.3',
        lastOnline: '2026-02-14T18:22:00+07:00',
        userId: 1,
        username: 'nguyenvana',
    },
    {
        id: 3,
        deviceCode: 'SG-ESP32-003',
        deviceName: 'ESP32-Greenhouse',
        location: 'Nhà kính',
        latitude: 16.0544,
        longitude: 108.2022,
        altitude: 12.0,
        status: 'ONLINE',
        firmwareVersion: 'v2.1.0',
        lastOnline: '2026-02-15T09:38:00+07:00',
        userId: 2,
        username: 'tranthib',
    },
    {
        id: 4,
        deviceCode: 'SG-ESP32-004',
        deviceName: 'ESP32-Farm-01',
        location: null,
        status: 'OFFLINE',
        firmwareVersion: 'v1.9.5',
        lastOnline: '2026-02-10T12:00:00+07:00',
        userId: null,
        username: null,
    },
];

// ============================================
// SENSOR DATA (current)
// ============================================

export const mockCurrentSensor: SensorData = {
    id: 500,
    deviceId: 1,
    soilMoisture: 42,
    temperature: 28.5,
    humidity: 65,
    lightIntensity: 3200,
    timestamp: '2026-02-15T09:40:00+07:00',
};

// ============================================
// MONITORING - 24h sensor history (30-min intervals)
// ============================================

function generateSensorHistory(): MonitoringSensorData[] {
    const data: MonitoringSensorData[] = [];
    const baseDate = new Date('2026-02-15T00:00:00+07:00');

    for (let i = 0; i < 48; i++) {
        const date = new Date(baseDate.getTime() + i * 30 * 60 * 1000);
        const hour = date.getHours();
        const timeStr = `${String(hour).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        // Realistic diurnal patterns
        const lightBase = hour >= 6 && hour <= 18
            ? Math.sin(((hour - 6) / 12) * Math.PI) * 8000
            : 50;

        data.push({
            time: timeStr,
            soilMoisture: 35 + Math.sin(i * 0.3) * 15 + Math.random() * 5,
            temperature: 24 + Math.sin(((hour - 6) / 24) * Math.PI * 2) * 6 + Math.random() * 1.5,
            humidity: 60 + Math.cos(((hour - 6) / 24) * Math.PI * 2) * 15 + Math.random() * 5,
            lightIntensity: Math.max(0, lightBase + Math.random() * 500),
        });
    }
    return data;
}

export const mockSensorHistory: MonitoringSensorData[] = generateSensorHistory();

// ============================================
// IRRIGATION CONFIG
// ============================================

export const mockIrrigationConfig: IrrigationConfig = {
    id: 1,
    deviceId: 1,
    autoMode: true,
    fuzzyEnabled: true,
    soilMoistureMin: 30,
    soilMoistureMax: 70,
    wateringDuration: 30,
};

// ============================================
// IRRIGATION HISTORY
// ============================================

export interface IrrigationHistoryExtended extends IrrigationHistory {
    status: IrrigationHistoryStatus;
}

export const mockIrrigationHistoryList: IrrigationHistoryExtended[] = [
    { id: 1, deviceId: 1, startTime: '2026-02-15T06:00:00+07:00', endTime: '2026-02-15T06:05:00+07:00', waterVolume: 2.1, duration: 300, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 2, deviceId: 1, startTime: '2026-02-15T09:30:00+07:00', endTime: '2026-02-15T09:31:30+07:00', waterVolume: 0.8, duration: 90, triggeredBy: 'AUTO', status: 'COMPLETED' },
    { id: 3, deviceId: 1, startTime: '2026-02-14T18:00:00+07:00', endTime: '2026-02-14T18:03:20+07:00', waterVolume: 1.5, duration: 200, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 4, deviceId: 1, startTime: '2026-02-14T14:15:00+07:00', endTime: '2026-02-14T14:16:00+07:00', waterVolume: 0.5, duration: 60, triggeredBy: 'MANUAL', status: 'COMPLETED' },
    { id: 5, deviceId: 1, startTime: '2026-02-14T10:00:00+07:00', endTime: '2026-02-14T10:04:10+07:00', waterVolume: 1.8, duration: 250, triggeredBy: 'ML', status: 'COMPLETED' },
    { id: 6, deviceId: 1, startTime: '2026-02-14T06:00:00+07:00', endTime: '2026-02-14T06:05:00+07:00', waterVolume: 2.3, duration: 300, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 7, deviceId: 1, startTime: '2026-02-13T18:00:00+07:00', endTime: '2026-02-13T18:03:20+07:00', waterVolume: 1.4, duration: 200, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 8, deviceId: 1, startTime: '2026-02-13T12:30:00+07:00', endTime: '2026-02-13T12:32:00+07:00', waterVolume: 1.0, duration: 120, triggeredBy: 'AUTO', status: 'COMPLETED' },
    { id: 9, deviceId: 1, startTime: '2026-02-13T09:45:00+07:00', endTime: '2026-02-13T09:46:30+07:00', waterVolume: 0.7, duration: 90, triggeredBy: 'ML', status: 'COMPLETED' },
    { id: 10, deviceId: 1, startTime: '2026-02-13T06:00:00+07:00', endTime: '2026-02-13T06:05:00+07:00', waterVolume: 2.0, duration: 300, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 11, deviceId: 1, startTime: '2026-02-12T18:00:00+07:00', endTime: '2026-02-12T18:03:20+07:00', waterVolume: 1.6, duration: 200, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 12, deviceId: 1, startTime: '2026-02-12T15:00:00+07:00', endTime: '2026-02-12T15:02:00+07:00', waterVolume: 1.1, duration: 120, triggeredBy: 'AUTO', status: 'COMPLETED' },
    { id: 13, deviceId: 1, startTime: '2026-02-12T11:20:00+07:00', endTime: '2026-02-12T11:21:00+07:00', waterVolume: 0.4, duration: 60, triggeredBy: 'MANUAL', status: 'COMPLETED' },
    { id: 14, deviceId: 1, startTime: '2026-02-12T06:00:00+07:00', endTime: '2026-02-12T06:05:00+07:00', waterVolume: 2.2, duration: 300, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 15, deviceId: 1, startTime: '2026-02-11T18:00:00+07:00', endTime: '2026-02-11T18:03:20+07:00', waterVolume: 1.3, duration: 200, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 16, deviceId: 1, startTime: '2026-02-11T13:10:00+07:00', endTime: '2026-02-11T13:12:30+07:00', waterVolume: 1.2, duration: 150, triggeredBy: 'ML', status: 'COMPLETED' },
    { id: 17, deviceId: 1, startTime: '2026-02-11T08:00:00+07:00', endTime: '2026-02-11T08:01:00+07:00', waterVolume: 0.6, duration: 60, triggeredBy: 'AUTO', status: 'COMPLETED' },
    { id: 18, deviceId: 1, startTime: '2026-02-11T06:00:00+07:00', endTime: '2026-02-11T06:05:00+07:00', waterVolume: 2.4, duration: 300, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 19, deviceId: 1, startTime: '2026-02-10T18:00:00+07:00', endTime: '2026-02-10T18:03:20+07:00', waterVolume: 1.5, duration: 200, triggeredBy: 'SCHEDULE', status: 'COMPLETED' },
    { id: 20, deviceId: 1, startTime: '2026-02-10T10:30:00+07:00', endTime: '2026-02-10T10:32:00+07:00', waterVolume: 0.9, duration: 120, triggeredBy: 'AUTO', status: 'COMPLETED' },
    { id: 21, deviceId: 1, startTime: '2026-02-15T09:45:00+07:00', endTime: '', waterVolume: 0, duration: 0, triggeredBy: 'AUTO', status: 'IN_PROGRESS' },
];

// ============================================
// SCHEDULES
// ============================================

export const mockScheduleDetails: ScheduleDetail[] = [
    {
        id: 1, deviceId: 1, name: 'Tưới sáng sớm', deviceName: 'ESP32-Garden-01',
        time: '06:00', daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'], duration: 300, isActive: true,
    },
    {
        id: 2, deviceId: 1, name: 'Tưới chiều tối', deviceName: 'ESP32-Garden-01',
        time: '18:00', daysOfWeek: ['MON', 'WED', 'FRI'], duration: 200, isActive: true,
    },
    {
        id: 3, deviceId: 1, name: 'Tưới trưa cuối tuần', deviceName: 'ESP32-Garden-01',
        time: '12:00', daysOfWeek: ['SAT', 'SUN'], duration: 450, isActive: false,
    },
    {
        id: 4, deviceId: 3, name: 'Tưới nhà kính sáng', deviceName: 'ESP32-Greenhouse',
        time: '07:30', daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], duration: 180, isActive: true,
    },
    {
        id: 5, deviceId: 3, name: 'Tưới nhà kính chiều', deviceName: 'ESP32-Greenhouse',
        time: '16:30', daysOfWeek: ['MON', 'WED', 'FRI'], duration: 240, isActive: true,
    },
];

// ============================================
// ML PREDICTIONS
// ============================================

export const mockMLPredictions: MLPredictionDetail[] = [
    { id: 1, deviceId: 1, predictedWaterAmount: 2.5, predictedTime: '2026-02-15T12:00:00+07:00', confidence: 0.92, createdAt: '2026-02-15T09:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.2', inputFeatures: { soilMoisture: 42, temperature: 28.5, humidity: 65, lightIntensity: 3200 } },
    { id: 2, deviceId: 1, predictedWaterAmount: 1.8, predictedTime: '2026-02-15T18:00:00+07:00', confidence: 0.87, createdAt: '2026-02-15T09:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.2', inputFeatures: { soilMoisture: 38, temperature: 30.2, humidity: 58, lightIntensity: 5500 } },
    { id: 3, deviceId: 1, predictedWaterAmount: 3.1, predictedTime: '2026-02-16T06:00:00+07:00', confidence: 0.78, createdAt: '2026-02-15T09:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.2', inputFeatures: { soilMoisture: 35, temperature: 26.0, humidity: 72, lightIntensity: 100 } },
    { id: 4, deviceId: 1, predictedWaterAmount: 2.0, predictedTime: '2026-02-14T12:00:00+07:00', confidence: 0.91, createdAt: '2026-02-14T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.2', inputFeatures: { soilMoisture: 40, temperature: 29.0, humidity: 62, lightIntensity: 4800 } },
    { id: 5, deviceId: 1, predictedWaterAmount: 1.5, predictedTime: '2026-02-14T18:00:00+07:00', confidence: 0.85, createdAt: '2026-02-14T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.2', inputFeatures: { soilMoisture: 45, temperature: 27.5, humidity: 68, lightIntensity: 2200 } },
    { id: 6, deviceId: 1, predictedWaterAmount: 2.8, predictedTime: '2026-02-13T12:00:00+07:00', confidence: 0.89, createdAt: '2026-02-13T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.1', inputFeatures: { soilMoisture: 36, temperature: 31.0, humidity: 55, lightIntensity: 6500 } },
    { id: 7, deviceId: 1, predictedWaterAmount: 0.8, predictedTime: '2026-02-13T18:00:00+07:00', confidence: 0.94, createdAt: '2026-02-13T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.1', inputFeatures: { soilMoisture: 55, temperature: 25.0, humidity: 75, lightIntensity: 800 } },
    { id: 8, deviceId: 1, predictedWaterAmount: 2.3, predictedTime: '2026-02-12T12:00:00+07:00', confidence: 0.83, createdAt: '2026-02-12T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.1', inputFeatures: { soilMoisture: 39, temperature: 28.8, humidity: 63, lightIntensity: 4200 } },
    { id: 9, deviceId: 1, predictedWaterAmount: 1.2, predictedTime: '2026-02-12T18:00:00+07:00', confidence: 0.90, createdAt: '2026-02-12T06:00:00+07:00', predictionType: 'IRRIGATION_TIME', modelVersion: 'ANFIS-v3.1', inputFeatures: { soilMoisture: 48, temperature: 26.5, humidity: 70, lightIntensity: 1500 } },
    { id: 10, deviceId: 1, predictedWaterAmount: 3.5, predictedTime: '2026-02-11T12:00:00+07:00', confidence: 0.76, createdAt: '2026-02-11T06:00:00+07:00', predictionType: 'WATER_AMOUNT', modelVersion: 'ANFIS-v3.1', inputFeatures: { soilMoisture: 30, temperature: 32.5, humidity: 50, lightIntensity: 7800 } },
];

// ============================================
// FUZZY LOGIC RESULTS
// ============================================

export const mockFuzzyResults: FuzzyLogicResult[] = [
    { id: 1, deviceId: 1, soilMoisture: 28, temperature: 32, humidity: 45, lightIntensity: 6500, irrigationDecision: 'HIGH', waterAmount: 3.2, membershipValues: { dry: 0.85, hot: 0.7, lowHumidity: 0.6, highLight: 0.8 }, timestamp: '2026-02-15T09:30:00+07:00' },
    { id: 2, deviceId: 1, soilMoisture: 42, temperature: 28, humidity: 65, lightIntensity: 3200, irrigationDecision: 'MEDIUM', waterAmount: 1.8, membershipValues: { normal: 0.6, warm: 0.5, normalHumidity: 0.7, mediumLight: 0.6 }, timestamp: '2026-02-15T09:00:00+07:00' },
    { id: 3, deviceId: 1, soilMoisture: 55, temperature: 25, humidity: 75, lightIntensity: 800, irrigationDecision: 'LOW', waterAmount: 0.5, membershipValues: { moist: 0.7, cool: 0.6, highHumidity: 0.8, lowLight: 0.9 }, timestamp: '2026-02-15T08:30:00+07:00' },
    { id: 4, deviceId: 1, soilMoisture: 72, temperature: 24, humidity: 80, lightIntensity: 200, irrigationDecision: 'NO_IRRIGATION', waterAmount: 0, membershipValues: { wet: 0.9, cool: 0.7, highHumidity: 0.9, lowLight: 0.95 }, timestamp: '2026-02-15T06:00:00+07:00' },
    { id: 5, deviceId: 1, soilMoisture: 35, temperature: 30, humidity: 55, lightIntensity: 5000, irrigationDecision: 'HIGH', waterAmount: 2.8, membershipValues: { dry: 0.65, hot: 0.55, lowHumidity: 0.45, highLight: 0.6 }, timestamp: '2026-02-14T14:00:00+07:00' },
    { id: 6, deviceId: 1, soilMoisture: 48, temperature: 27, humidity: 68, lightIntensity: 2500, irrigationDecision: 'MEDIUM', waterAmount: 1.2, membershipValues: { normal: 0.75, warm: 0.4, normalHumidity: 0.65, mediumLight: 0.5 }, timestamp: '2026-02-14T10:00:00+07:00' },
    { id: 7, deviceId: 1, soilMoisture: 60, temperature: 26, humidity: 72, lightIntensity: 1200, irrigationDecision: 'LOW', waterAmount: 0.3, membershipValues: { moist: 0.6, cool: 0.5, highHumidity: 0.7, lowLight: 0.7 }, timestamp: '2026-02-14T08:00:00+07:00' },
    { id: 8, deviceId: 1, soilMoisture: 25, temperature: 34, humidity: 40, lightIntensity: 8000, irrigationDecision: 'HIGH', waterAmount: 4.0, membershipValues: { veryDry: 0.9, veryHot: 0.85, veryLowHumidity: 0.8, veryHighLight: 0.9 }, timestamp: '2026-02-13T13:00:00+07:00' },
];

// ============================================
// DEVICE STATUS (for dashboard compatibility)
// ============================================

export const mockDeviceStatus: DeviceStatus = {
    id: 1,
    name: 'ESP32-Garden-01',
    status: 'ONLINE',
    lastOnline: '2026-02-15T09:40:00+07:00',
    gpioPin: 25,
};

// ============================================
// WATER BALANCE (FAO-56) - Device state & history
// ============================================

/** Lịch sử soil moisture / depletion cho biểu đồ (7 ngày gần nhất) */
function generateSoilMoisHistory(deviceId: number): Array<Record<string, unknown>> {
    const history: Array<Record<string, unknown>> = [];
    const baseDate = new Date('2026-02-09T06:00:00+07:00');
    let shallow = 12;
    let deep = 18;
    for (let d = 0; d < 7; d++) {
        const date = new Date(baseDate.getTime() + d * 24 * 60 * 60 * 1000);
        shallow = Math.min(28, Math.max(5, shallow + (Math.random() - 0.4) * 6));
        deep = Math.min(45, Math.max(10, deep + (Math.random() - 0.3) * 5));
        const weighted = 0.4 * shallow + 0.6 * deep;
        history.push({
            timestamp: date.toISOString(),
            shallowDepletion: Math.round(shallow * 100) / 100,
            deepDepletion: Math.round(deep * 100) / 100,
            weightedDepletion: Math.round(weighted * 100) / 100,
        });
    }
    return history;
}

export const mockSoilMoisHistoryDevice1 = generateSoilMoisHistory(1);
export const mockSoilMoisHistoryDevice2 = generateSoilMoisHistory(2);
export const mockSoilMoisHistoryDevice3 = generateSoilMoisHistory(3);

/** Water balance state theo device (FAO-56) */
export const mockWaterBalanceStateDevice1: WaterBalanceStateResponse = {
    deviceId: 1,
    shallowDepletion: 18.5,
    deepDepletion: 32.2,
    shallowTaw: 45,
    deepTaw: 75,
    shallowRaw: 22.5,
    deepRaw: 37.5,
    weightedDepletion: 26.22,
    totalTaw: 120,
    totalRaw: 60,
    lastIrrigation: 8.5,
    soilMoisHistory: mockSoilMoisHistoryDevice1,
    soilMoisTrend: -1.2,
    lastUpdated: '2026-02-15T09:40:00+07:00',
};

export const mockWaterBalanceStateDevice2: WaterBalanceStateResponse = {
    deviceId: 2,
    shallowDepletion: 8.2,
    deepDepletion: 14.0,
    shallowTaw: 42,
    deepTaw: 70,
    shallowRaw: 21,
    deepRaw: 35,
    weightedDepletion: 11.72,
    totalTaw: 112,
    totalRaw: 56,
    lastIrrigation: 12.0,
    soilMoisHistory: mockSoilMoisHistoryDevice2,
    soilMoisTrend: 0.5,
    lastUpdated: '2026-02-14T18:22:00+07:00',
};

export const mockWaterBalanceStateDevice3: WaterBalanceStateResponse = {
    deviceId: 3,
    shallowDepletion: 20.0,
    deepDepletion: 28.5,
    shallowTaw: 48,
    deepTaw: 80,
    shallowRaw: 24,
    deepRaw: 40,
    weightedDepletion: 25.1,
    totalTaw: 128,
    totalRaw: 64,
    lastIrrigation: 6.0,
    soilMoisHistory: mockSoilMoisHistoryDevice3,
    soilMoisTrend: -2.1,
    lastUpdated: '2026-02-15T09:38:00+07:00',
};

/** Map deviceId -> water balance state (dùng cho tab FAO-56) */
export const mockWaterBalanceStateByDeviceId: Record<number, WaterBalanceStateResponse> = {
    1: mockWaterBalanceStateDevice1,
    2: mockWaterBalanceStateDevice2,
    3: mockWaterBalanceStateDevice3,
};

// ============================================
// DAILY WATER BALANCE (FAO-56 theo ngày)
// ============================================

export const mockDailyWaterBalanceList: DailyWaterBalanceResponse[] = [
    { id: 1, seasonId: 1, date: '2026-02-15', cropAge: 25, et0Value: 4.2, kcCurrent: 1.05, etcValue: 4.41, effectiveRain: 0, irrigationAmount: 8.5, dcValue: 0.42, recommendation: 'Tưới bổ sung 8–10 mm để duy trì độ ẩm tối ưu.' },
    { id: 2, seasonId: 1, date: '2026-02-14', cropAge: 24, et0Value: 4.5, kcCurrent: 1.04, etcValue: 4.68, effectiveRain: 2.0, irrigationAmount: 6.0, dcValue: 0.38, recommendation: 'Đủ ẩm sau mưa; theo dõi DC ngày mai.' },
    { id: 3, seasonId: 1, date: '2026-02-13', cropAge: 23, et0Value: 4.8, kcCurrent: 1.03, etcValue: 4.94, effectiveRain: 0, irrigationAmount: 10.0, dcValue: 0.45, recommendation: 'Đã tưới đủ; kiểm tra cảm biến ẩm đất.' },
    { id: 4, seasonId: 1, date: '2026-02-12', cropAge: 22, et0Value: 4.0, kcCurrent: 1.02, etcValue: 4.08, effectiveRain: 0, irrigationAmount: 9.0, dcValue: 0.40, recommendation: 'Dự báo nắng nóng; tăng lượng tưới nếu cần.' },
    { id: 5, seasonId: 1, date: '2026-02-11', cropAge: 21, et0Value: 3.8, kcCurrent: 1.01, etcValue: 3.84, effectiveRain: 5.0, irrigationAmount: 0, dcValue: 0.32, recommendation: 'Mưa đủ; không cần tưới.' },
];

// ============================================
// WEATHER DATA (OpenWeather)
// ============================================

// Generate mock current weather data
export const mockCurrentWeather: WeatherData = {
    id: 1,
    location: 'Hà Nội',
    temperature: 28.5,
    humidity: 65,
    precipitation: 0,
    precipitationProbability: 0.15,
    windSpeed: 3.2,
    uvIndex: 6.5,
    forecastTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
};

// Generate mock weather forecast for 5 days
const generateForecastDates = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
};

export const mockWeatherForecast: DailyWeatherForecast[] = generateForecastDates().map((date, index) => {
    const baseTemp = 28 + Math.sin(index * 0.5) * 3;
    const rain = index === 2 ? 8.5 : index === 4 ? 2.0 : 0;
    const clouds = index === 2 ? 75 : index === 4 ? 45 : 20 + index * 5;
    const precipProb = rain > 0 ? 0.7 : 0.1 + index * 0.05;

    return {
        id: index + 1,
        location: 'Hà Nội',
        forecastDate: date,
        tempMin: Math.round((baseTemp - 3) * 10) / 10,
        tempMax: Math.round((baseTemp + 3) * 10) / 10,
        tempAvg: Math.round(baseTemp * 10) / 10,
        humidityAvg: Math.round(60 + Math.sin(index) * 10),
        windSpeedAvg: Math.round((2.5 + index * 0.3) * 10) / 10,
        totalRain: rain,
        precipProbAvg: Math.round(precipProb * 100) / 100,
        avgClouds: Math.round(clouds),
    };
});

// Mock weather data by city
export const mockCurrentWeatherByLocation: Record<string, WeatherData> = {
    'Hà Nội': mockCurrentWeather,
    'TP. Hồ Chí Minh': {
        ...mockCurrentWeather,
        id: 2,
        location: 'TP. Hồ Chí Minh',
        temperature: 32.5,
        humidity: 75,
    },
    'Đà Nẵng': {
        ...mockCurrentWeather,
        id: 3,
        location: 'Đà Nẵng',
        temperature: 30.0,
        humidity: 68,
    },
    'Hải Phòng': {
        ...mockCurrentWeather,
        id: 4,
        location: 'Hải Phòng',
        temperature: 27.8,
        humidity: 72,
    },
    'Cần Thơ': {
        ...mockCurrentWeather,
        id: 5,
        location: 'Cần Thơ',
        temperature: 31.2,
        humidity: 78,
    },
};

export const mockWeatherForecastByLocation: Record<string, DailyWeatherForecast[]> = {
    'Hà Nội': mockWeatherForecast,
    'TP. Hồ Chí Minh': mockWeatherForecast.map((f, i) => ({
        ...f,
        id: f.id + 10,
        location: 'TP. Hồ Chí Minh',
        tempMin: (f.tempMin ?? 0) + 2,
        tempMax: (f.tempMax ?? 0) + 4,
        tempAvg: (f.tempAvg ?? 0) + 3,
        humidityAvg: (f.humidityAvg ?? 0) + 10,
    })),
    'Đà Nẵng': mockWeatherForecast.map((f, i) => ({
        ...f,
        id: f.id + 20,
        location: 'Đà Nẵng',
        tempMin: (f.tempMin ?? 0) + 1,
        tempMax: (f.tempMax ?? 0) + 2,
        tempAvg: (f.tempAvg ?? 0) + 1.5,
        humidityAvg: (f.humidityAvg ?? 0) + 5,
    })),
    'Hải Phòng': mockWeatherForecast.map((f, i) => ({
        ...f,
        id: f.id + 30,
        location: 'Hải Phòng',
        tempMin: (f.tempMin ?? 0) - 1,
        tempMax: (f.tempMax ?? 0) - 0.5,
        tempAvg: (f.tempAvg ?? 0) - 0.8,
        humidityAvg: (f.humidityAvg ?? 0) + 8,
    })),
    'Cần Thơ': mockWeatherForecast.map((f, i) => ({
        ...f,
        id: f.id + 40,
        location: 'Cần Thơ',
        tempMin: (f.tempMin ?? 0) + 2.5,
        tempMax: (f.tempMax ?? 0) + 3.5,
        tempAvg: (f.tempAvg ?? 0) + 3,
        humidityAvg: (f.humidityAvg ?? 0) + 12,
    })),
};
