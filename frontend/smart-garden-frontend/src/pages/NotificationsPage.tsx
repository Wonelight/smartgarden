import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell,
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle2,
    Filter,
    CheckCheck,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { notificationsApi, type NotificationItem, type NotificationCategory } from '../api/notifications';
import { getApiErrorMessage } from '../utils/apiError';

const TEAL = '#2DD4BF';

type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

const getTypeConfig = (type: NotificationType) => {
    switch (type) {
        case 'ERROR':
            return {
                icon: AlertCircle,
                bgColor: 'bg-red-50',
                textColor: 'text-red-600',
                borderColor: 'border-red-200',
            };
        case 'WARNING':
            return {
                icon: AlertTriangle,
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-600',
                borderColor: 'border-amber-200',
            };
        case 'SUCCESS':
            return {
                icon: CheckCircle2,
                bgColor: 'bg-emerald-50',
                textColor: 'text-emerald-600',
                borderColor: 'border-emerald-200',
            };
        case 'INFO':
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
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [totalUnread, setTotalUnread] = useState(0);
    const [markingAll, setMarkingAll] = useState(false);

    const fetchNotifications = useCallback(async (pageNum: number, category: NotificationCategory | 'all', replace: boolean) => {
        try {
            const data = await notificationsApi.getMyNotifications({
                page: pageNum,
                size: 20,
                ...(category !== 'all' ? { category } : {}),
            });
            setNotifications(prev => replace ? data.content : [...prev, ...data.content]);
            setHasNext(data.hasNext);
            setPage(pageNum);
        } catch (err) {
            toast.error(getApiErrorMessage(err));
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const count = await notificationsApi.countUnread();
            setTotalUnread(count);
        } catch {
            // non-critical
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchNotifications(0, filter, true),
            fetchUnreadCount(),
        ]).finally(() => setLoading(false));
    }, [filter, fetchNotifications, fetchUnreadCount]);

    const markAsRead = async (notif: NotificationItem) => {
        if (notif.read) return;
        try {
            await notificationsApi.markAsRead(notif.id);
            setNotifications(prev =>
                prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
            );
            setTotalUnread(prev => Math.max(0, prev - 1));
        } catch (err) {
            toast.error(getApiErrorMessage(err));
        }
    };

    const markAllAsRead = async () => {
        setMarkingAll(true);
        try {
            await notificationsApi.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setTotalUnread(0);
            toast.success('Đã đánh dấu tất cả là đã đọc');
        } catch (err) {
            toast.error(getApiErrorMessage(err));
        } finally {
            setMarkingAll(false);
        }
    };

    const loadMore = async () => {
        setLoadingMore(true);
        await fetchNotifications(page + 1, filter, false);
        setLoadingMore(false);
    };

    const filterOptions: { value: NotificationCategory | 'all'; label: string }[] = [
        { value: 'all', label: 'Tất cả' },
        { value: 'SOIL', label: 'Độ ẩm đất' },
        { value: 'DEVICE', label: 'Thiết bị' },
        { value: 'IRRIGATION', label: 'Tưới tiêu' },
        { value: 'SYSTEM', label: 'Hệ thống' },
    ];

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                        Thông báo
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {totalUnread > 0
                            ? `${totalUnread} thông báo chưa đọc`
                            : 'Tất cả đã đọc'}
                    </p>
                </div>
                {totalUnread > 0 && (
                    <button
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        className="flex items-center gap-2 px-4 py-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {markingAll
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCheck className="w-4 h-4" />
                        }
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
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.length === 0 ? (
                        <div className="bg-white rounded-sm border border-slate-200 p-12 text-center">
                            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">Không có thông báo nào</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Các cảnh báo và thông báo sẽ xuất hiện ở đây
                            </p>
                        </div>
                    ) : (
                        <>
                            {notifications.map((notif) => {
                                const config = getTypeConfig(notif.type);
                                const Icon = config.icon;
                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => markAsRead(notif)}
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
                                                <div>
                                                    <h3 className={`font-semibold ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                                                        {notif.title}
                                                    </h3>
                                                    {notif.deviceName && (
                                                        <span className="text-xs text-slate-400">{notif.deviceName}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400 shrink-0">
                                                    {formatTime(notif.createdAt)}
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
                            })}

                            {hasNext && (
                                <div className="flex justify-center pt-2">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    >
                                        {loadingMore
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</>
                                            : 'Xem thêm'
                                        }
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};