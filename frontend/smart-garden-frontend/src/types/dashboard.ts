/**
 * Dashboard type definitions matching database schema
 */

// Sensor_Data table
export interface SensorData {
    id: number;
    deviceId: number;
    soilMoisture: number;        // %
    temperature: number;          // °C
    humidity: number;             // %
    lightIntensity: number;       // lux
    timestamp: string;            // ISO datetime
}

// Device table
export interface DeviceStatus {
    id: number;
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    lastOnline: string;           // ISO datetime
    gpioPin: number;
}

// Irrigation_Config table
export interface IrrigationConfig {
    id: number;
    deviceId: number;
    autoMode: boolean;
    fuzzyEnabled: boolean;
    soilMoistureMin: number;      // %
    soilMoistureMax: number;      // %
    wateringDuration: number;     // seconds
}

// Irrigation_History table
export interface IrrigationHistory {
    id: number;
    deviceId: number;
    startTime: string;
    endTime: string;
    waterVolume: number;          // liters
    duration: number;             // seconds
    triggeredBy: 'MANUAL' | 'AUTO' | 'SCHEDULE' | 'ML';
}

// ML_Prediction table
export interface MLPrediction {
    id: number;
    deviceId: number;
    predictedWaterAmount: number; // liters
    predictedTime: string;
    confidence: number;           // 0-1
    createdAt: string;
}

// System_Log table
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface SystemLog {
    id: number;
    logLevel: LogLevel;
    source: string;
    message: string;
    timestamp: string;
}

// Schedule table
export interface Schedule {
    id: number;
    deviceId: number;
    time: string;                 // HH:mm format
    daysOfWeek: string[];         // ['MON', 'TUE', ...]
    duration: number;             // seconds
    isActive: boolean;
}

// Device_Control command
export interface DeviceControl {
    command: 'PUMP_ON' | 'PUMP_OFF';
    duration?: number;
}

// Chart data types
export interface SensorChartData {
    time: string;
    soilMoisture: number;
    lightIntensity: number;
}

export interface WaterUsageData {
    day: string;
    waterVolume: number;
}

// Fuzzy Logic Result
export interface FuzzyLogicResult {
    id: number;
    deviceId: number;
    soilMoisture: number;
    temperature: number;
    humidity: number;
    lightIntensity: number;
    irrigationDecision: 'NO_IRRIGATION' | 'LOW' | 'MEDIUM' | 'HIGH';
    waterAmount: number;             // liters
    membershipValues: Record<string, number>;
    timestamp: string;
}

// Extended sensor chart data for monitoring (includes temp & humidity)
export interface MonitoringSensorData {
    time: string;
    soilMoisture: number;
    temperature: number;
    humidity: number;
    lightIntensity: number;
}

// Irrigation history status
export type IrrigationHistoryStatus = 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';

// Schedule with name field for the schedules page
export interface ScheduleDetail extends Schedule {
    name: string;
    deviceName: string;
}

// ML Prediction with extra fields for predictions page
export interface MLPredictionDetail extends MLPrediction {
    predictionType: 'WATER_AMOUNT' | 'IRRIGATION_TIME' | 'SOIL_MOISTURE';
    modelVersion: string;
    inputFeatures: Record<string, number>;
}
