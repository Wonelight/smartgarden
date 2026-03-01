import React, { useState, useEffect } from 'react';
import { Bell, Thermometer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/Button';

const TEAL = '#2DD4BF';

interface SettingItem {
    id: string;
    name: string;
    label: string;
    description?: string;
    type: 'switch' | 'select';
    defaultChecked?: boolean;
    defaultValue?: string;
    options?: { value: string; label: string }[];
}

const NOTIFICATION_SETTINGS: SettingItem[] = [
    {
        id: 'notif_soil_low',
        name: 'notif_soil_low',
        label: 'Cảnh báo độ ẩm đất thấp',
        description: 'Gửi thông báo khi độ ẩm đất dưới ngưỡng tối thiểu',
        type: 'switch',
        defaultChecked: true,
    },
    {
        id: 'notif_device_offline',
        name: 'notif_device_offline',
        label: 'Cảnh báo thiết bị offline',
        description: 'Thông báo khi thiết bị mất kết nối',
        type: 'switch',
        defaultChecked: true,
    },
    {
        id: 'notif_irrigation_done',
        name: 'notif_irrigation_done',
        label: 'Thông báo hoàn tất tưới',
        description: 'Gửi thông báo sau khi hệ thống tưới xong',
        type: 'switch',
        defaultChecked: false,
    },
    {
        id: 'notif_email_critical',
        name: 'notif_email_critical',
        label: 'Gửi email khi có lỗi nghiêm trọng',
        description: 'Email khi phát hiện lỗi ERROR hoặc CRITICAL',
        type: 'switch',
        defaultChecked: true,
    },
];

const UNIT_SETTINGS: SettingItem[] = [
    {
        id: 'unit_temp',
        name: 'unit_temp',
        label: 'Đơn vị nhiệt độ',
        type: 'select',
        defaultValue: 'C',
        options: [
            { value: 'C', label: '°C (Celsius)' },
            { value: 'F', label: '°F (Fahrenheit)' },
        ],
    },
    {
        id: 'unit_water',
        name: 'unit_water',
        label: 'Đơn vị lượng nước',
        type: 'select',
        defaultValue: 'L',
        options: [
            { value: 'L', label: 'Lít (L)' },
            { value: 'mL', label: 'Mililít (mL)' },
        ],
    },
];

export const SettingsPage: React.FC = () => {
    const [notificationValues, setNotificationValues] = useState<Record<string, boolean>>({});
    const [unitValues, setUnitValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const notif: Record<string, boolean> = {};
        NOTIFICATION_SETTINGS.forEach((i) => {
            notif[i.name] = i.defaultChecked ?? false;
        });
        setNotificationValues(notif);

        const unit: Record<string, string> = {};
        UNIT_SETTINGS.forEach((i) => {
            unit[i.name] = i.defaultValue ?? i.options?.[0]?.value ?? '';
        });
        setUnitValues(unit);
    }, []);

    const handleNotificationChange = (name: string, checked: boolean) => {
        setNotificationValues((prev) => ({ ...prev, [name]: checked }));
    };

    const handleUnitChange = (name: string, value: string) => {
        setUnitValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // TODO: Gọi API lưu cài đặt
            await new Promise((r) => setTimeout(r, 800));
            toast.success('Đã lưu cài đặt thành công!');
        } catch {
            toast.error('Không thể lưu cài đặt');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                    Cài đặt
                </h1>
                <p className="text-slate-500 mt-1">
                    Cấu hình thông báo và tùy chọn hiển thị cho Smart Garden
                </p>
            </div>

            {/* Thông báo */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <Bell className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Thông báo</h2>
                        <p className="text-sm text-slate-500">Quản lý các cảnh báo và thông báo hệ thống</p>
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    {NOTIFICATION_SETTINGS.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 border-b border-slate-100 last:border-0"
                        >
                            <div>
                                <p className="font-medium text-slate-800">{item.label}</p>
                                {item.description && (
                                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                                )}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={notificationValues[item.name] ?? item.defaultChecked ?? false}
                                    onChange={(e) => handleNotificationChange(item.name, e.target.checked)}
                                    className="w-5 h-5 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-slate-600">
                                    {notificationValues[item.name] ? 'Bật' : 'Tắt'}
                                </span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Đơn vị */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <Thermometer className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Đơn vị hiển thị</h2>
                        <p className="text-sm text-slate-500">Nhiệt độ, độ ẩm, lượng nước</p>
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    {UNIT_SETTINGS.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 border-b border-slate-100 last:border-0"
                        >
                            <label className="font-medium text-slate-800">{item.label}</label>
                            <select
                                value={unitValues[item.name] ?? item.defaultValue ?? ''}
                                onChange={(e) => handleUnitChange(item.name, e.target.value)}
                                className="w-full sm:w-48 rounded-sm border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            >
                                {item.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    className="bg-teal-500 hover:bg-teal-600 text-white border-0 rounded-sm"
                >
                    Lưu cài đặt
                </Button>
            </div>
        </div>
    );
};
