import React, { useState, useEffect, useRef } from 'react';
import { Power, Settings2, Droplets, Loader2, Zap, Minus, Plus } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import type { IrrigationConfig } from '../../types/dashboard';

interface ControlPanelProps {
    config: IrrigationConfig;
    onConfigChange: (config: Partial<IrrigationConfig>) => void;
    onManualIrrigation: () => Promise<void>;
    isLoading?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    config,
    onConfigChange,
    onManualIrrigation,
    isLoading = false,
}) => {
    const [isIrrigating, setIsIrrigating] = useState(false);

    const handleManualIrrigation = async () => {
        setIsIrrigating(true);
        try {
            await onManualIrrigation();
        } finally {
            setIsIrrigating(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600">
                    <Settings2 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Bảng điều khiển</h3>
                    <p className="text-sm text-slate-500">Cấu hình hệ thống tưới</p>
                </div>
            </div>

            <div className="space-y-5">
                {/* Toggle switches */}
                <div className="grid grid-cols-1 gap-3">
                    <ToggleSwitch
                        label="Chế độ tự động"
                        description="Tự động tưới khi độ ẩm thấp"
                        checked={config.autoMode}
                        onCheckedChange={(checked) => onConfigChange({ autoMode: checked })}
                        icon={<Power className="w-4 h-4" />}
                        disabled={isLoading}
                    />
                    <ToggleSwitch
                        label="Fuzzy Logic"
                        description="Điều khiển thông minh AI"
                        checked={config.fuzzyEnabled}
                        onCheckedChange={(checked) => onConfigChange({ fuzzyEnabled: checked })}
                        icon={<Zap className="w-4 h-4" />}
                        disabled={isLoading}
                    />
                </div>

                {/* Threshold sliders */}
                <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-medium text-slate-700 mb-4">Ngưỡng độ ẩm đất</h4>
                    <div className="space-y-4">
                        <ThresholdSlider
                            label="Ngưỡng tối thiểu"
                            value={config.soilMoistureMin}
                            min={0}
                            max={100}
                            onChange={(value) => onConfigChange({ soilMoistureMin: value })}
                            color="from-red-400 to-orange-400"
                            disabled={isLoading}
                        />
                        <ThresholdSlider
                            label="Ngưỡng tối đa"
                            value={config.soilMoistureMax}
                            min={0}
                            max={100}
                            onChange={(value) => onConfigChange({ soilMoistureMax: value })}
                            color="from-blue-400 to-cyan-400"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {/* Duration Input */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-slate-700">Thời gian tưới</h4>
                        <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                            {Math.floor(config.wateringDuration / 60)}m{String(config.wateringDuration % 60).padStart(2, '0')}s
                        </span>
                    </div>
                    <DurationInput
                        value={config.wateringDuration}
                        onChange={(value) => onConfigChange({ wateringDuration: value })}
                        min={10}
                        max={1000}
                        disabled={isLoading}
                    />
                </div>

                {/* Manual irrigation button */}
                <div className="pt-4 border-t border-slate-100">
                    <button
                        onClick={handleManualIrrigation}
                        disabled={isIrrigating || isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isIrrigating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang tưới...
                            </>
                        ) : (
                            <>
                                <Droplets className="w-5 h-5" />
                                Tưới ngay
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Toggle Switch component
interface ToggleSwitchProps {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    icon: React.ReactNode;
    disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    label,
    description,
    checked,
    onCheckedChange,
    icon,
    disabled = false,
}) => {
    return (
        <label className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer ${checked
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${checked ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{description}</p>
                </div>
            </div>
            <Switch.Root
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className="flex-shrink-0 ml-3 w-11 h-6 bg-slate-200 rounded-full relative data-[state=checked]:bg-emerald-500 transition-colors outline-none focus:outline-none"
            >
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transition-transform translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
        </label>
    );
};

// Threshold Slider component
interface ThresholdSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    color: string;
    disabled?: boolean;
}

const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
    label,
    value,
    min,
    max,
    onChange,
    color,
    disabled = false,
}) => {
    // Local state for instant feedback during dragging
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<any>(null);

    // Sync local state when external value changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        setLocalValue(newValue);

        // Optional: debounce the parent update if it's expensive/API call
        // For now, let's keep it responsive but remove the CSS transition lag
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
        }, 50); // Small debounce to avoid flooding state updates
    };

    return (
        <div className="space-y-2 group/slider">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 transition-colors group-hover/slider:text-emerald-600">
                    {label}
                </span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">
                    {localValue}%
                </span>
            </div>
            <div className="relative h-6 flex items-center">
                {/* Background track */}
                <div className="absolute inset-x-0 h-2 bg-slate-100 rounded-full border border-slate-200/30 pointer-events-none" />

                {/* Gradient fill - Transition removed for instant tracking */}
                <div
                    className={`absolute left-0 h-2 rounded-full bg-gradient-to-r ${color} pointer-events-none`}
                    style={{ width: `${((localValue - min) / (max - min)) * 100}%` }}
                />

                {/* Slider input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={localValue}
                    onChange={handleSliderChange}
                    disabled={disabled}
                    className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-6
                        [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)]
                        [&::-webkit-slider-thumb]:border-[3px]
                        [&::-webkit-slider-thumb]:border-emerald-500
                        [&::-webkit-slider-thumb]:cursor-grab
                        [&::-webkit-slider-thumb]:active:cursor-grabbing
                        [&::-webkit-slider-thumb]:transition-all
                        [&::-webkit-slider-thumb]:hover:scale-110
                        [&::-webkit-slider-thumb]:active:scale-95
                        [&::-moz-range-thumb]:appearance-none
                        [&::-moz-range-thumb]:w-6
                        [&::-moz-range-thumb]:h-6
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white
                        [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)]
                        [&::-moz-range-thumb]:border-[3px]
                        [&::-moz-range-thumb]:border-emerald-500
                        [&::-moz-range-thumb]:cursor-grab
                        [&::-moz-range-thumb]:active:cursor-grabbing
                        [&::-moz-range-thumb]:transition-all
                        [&::-moz-range-thumb]:hover:scale-110
                        [&::-moz-range-thumb]:active:scale-95"
                />
            </div>
        </div>
    );
};

// Duration Input component
interface DurationInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
}

const DurationInput: React.FC<DurationInputProps> = ({
    value,
    onChange,
    min,
    max,
    disabled = false,
}) => {
    const [inputValue, setInputValue] = useState(value.toString());

    const handleIncrement = () => {
        const newValue = Math.min(value + 5, max);
        onChange(newValue);
        setInputValue(newValue.toString());
    };

    const handleDecrement = () => {
        const newValue = Math.max(value - 5, min);
        onChange(newValue);
        setInputValue(newValue.toString());
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;

        // Allow only numbers
        if (rawValue === '' || /^\d+$/.test(rawValue)) {
            setInputValue(rawValue);

            // Validate and update if valid number
            if (rawValue !== '') {
                const numValue = parseInt(rawValue, 10);
                if (!isNaN(numValue)) {
                    const clampedValue = Math.max(min, Math.min(max, numValue));
                    onChange(clampedValue);
                }
            }
        }
    };

    const handleBlur = () => {
        // On blur, ensure value is within range
        if (inputValue === '' || isNaN(parseInt(inputValue, 10))) {
            setInputValue(value.toString());
        } else {
            const numValue = parseInt(inputValue, 10);
            const clampedValue = Math.max(min, Math.min(max, numValue));
            setInputValue(clampedValue.toString());
            if (clampedValue !== value) {
                onChange(clampedValue);
            }
        }
    };

    // Update input when value prop changes externally
    React.useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={handleDecrement}
                disabled={disabled || value <= min}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Minus className="w-4 h-4" />
            </button>

            <div className="flex-1 space-y-1">
                <div className="relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        disabled={disabled}
                        className="w-full px-4 py-2.5 text-center text-lg font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                        second
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleIncrement}
                disabled={disabled || value >= max}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
};
