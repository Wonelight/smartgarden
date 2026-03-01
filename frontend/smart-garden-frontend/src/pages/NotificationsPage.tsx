import React, { useState } from 'react';
import {
    Bell,
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle2,
    Filter,
    CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const TEAL = '#2DD4BF';

type NotificationType = 'info' | 'warning' | 'error' | 'success';
type NotificationCategory = 'soil' | 'device' | 'irrigation' | 'system' | 'all';

interface Notification {
    id: number;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: 1,
        type: 'success',
        category: 'irrigation',
        title: 'Hoàn tất tưới',
        message: 'Hệ thống đã tưới xong cho ESP32-Garden-01. Lượng nước: 2.1L',
        timestamp: '2026-02-15T09:35:00+07:00',
        read: false,
    },
    {
        id: 2,
        type: 'warning',
        category: 'soil',
        title: 'Độ ẩm đất thấp',
        message: 'Độ ẩm đất (28%) thấp hơn ngưỡng tối thiểu (30%). Xem xét tưới thủ công.',
        timestamp: '2026-02-15T09:30:00+07:00',
        read: false,
    },
    {
        id: 3,
        type: 'info',
        category: 'system',
        title: 'Cập nhật dự báo',
        message: 'Dự báo ML mới với độ tin cậy 87% đã được cập nhật.',
        timestamp: '2026-02-15T09:00:00+07:00',
        read: true,
    },
    {
        id: 4,
        type: 'error',
        category: 'device',
        title: 'Thiết bị mất kết nối',
        message: 'ESP32-Garden-01 mất kết nối MQTT. Đang thử kết nối lại...',
        timestamp: '2026-02-15T08:45:00+07:00',
        read: true,
    },
    {
        id: 5,
        type: 'success',
        category: 'device',
        title: 'Thiết bị kết nối',
        message: 'ESP32-Garden-01 đã kết nối thành công.',
        timestamp: '2026-02-15T08:30:00+07:00',
        read: true,
    },
];

const getTypeConfig = (type: NotificationType) => {
    switch (type) {
        case 'error':
            return {
                icon: AlertCircle,
                bgColor: 'bg-red-50',
                textColor: 'text-red-600',
                borderColor: 'border-red-200',
            };
        case 'warning':
            return {
                icon: AlertTriangle,
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-600',
                borderColor: 'border-amber-200',
            };
        case 'success':
            return {
                icon: CheckCircle2,
                bgColor: 'bg-emerald-50',
                textColor: 'text-emerald-600',
                borderColor: 'border-emerald-200',
            };
        case 'info':
        default:
            return {
                icon: Info,
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-600',
                borderColor: 'border-blue-200',
            };
    }
};

const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const NotificationsPage: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
    const [filter, setFilter] = useState<NotificationCategory>('all');

    const filtered = filter === 'all'
        ? notifications
        : notifications.filter((n) => n.category === filter);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAsRead = (id: number) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
    };

    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success('Đã đánh dấu tất cả là đã đọc');
    };

    const filterOptions: { value: NotificationCategory; label: string }[] = [
        { value: 'all', label: 'Tất cả' },
        { value: 'soil', label: 'Độ ẩm đất' },
        { value: 'device', label: 'Thiết bị' },
        { value: 'irrigation', label: 'Tưới tiêu' },
        { value: 'system', label: 'Hệ thống' },
    ];

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                        Thông báo
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {unreadCount > 0
                            ? `${unreadCount} thông báo chưa đọc`
                            : 'Tất cả đã đọc'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            {/* Bộ lọc */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                {filterOptions.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setFilter(opt.value)}
                        className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                            filter === opt.value
                                ? 'bg-teal-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        style={filter === opt.value ? { backgroundColor: TEAL } : undefined}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Danh sách thông báo */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-sm border border-slate-200 p-12 text-center">
                        <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Không có thông báo nào</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Các cảnh báo và thông báo sẽ xuất hiện ở đây
                        </p>
                    </div>
                ) : (
                    filtered.map((notif) => {
                        const config = getTypeConfig(notif.type);
                        const Icon = config.icon;
                        return (
                            <div
                                key={notif.id}
                                onClick={() => !notif.read && markAsRead(notif.id)}
                                className={`
                                    flex gap-4 p-4 rounded-sm border cursor-pointer transition-all
                                    ${config.bgColor} ${config.borderColor}
                                    ${!notif.read ? 'border-l-4' : ''}
                                `}
                            >
                                <div className={`p-2 rounded-sm shrink-0 ${config.textColor}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className={`font-semibold ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {notif.title}
                                        </h3>
                                        <span className="text-xs text-slate-400 shrink-0">
                                            {formatTime(notif.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                                    {!notif.read && (
                                        <span className="inline-block mt-2 text-xs font-medium text-teal-600">
                                            Nhấn để đánh dấu đã đọc
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
