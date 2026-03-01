import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    HelpCircle,
    Mail,
    MessageCircle,
    BookOpen,
    ChevronDown,
    ChevronRight,
    ExternalLink,
} from 'lucide-react';

const TEAL = '#2DD4BF';

const FAQ_ITEMS = [
    {
        id: 'faq-1',
        question: 'Làm thế nào để xem dữ liệu cảm biến từ thiết bị?',
        answer: 'Vào Dashboard để xem độ ẩm đất, nhiệt độ, độ ẩm không khí và cường độ ánh sáng theo thời gian thực. Bạn có thể làm mới dữ liệu bằng nút "Làm mới" ở góc phải.',
    },
    {
        id: 'faq-2',
        question: 'Cách bật/tắt chế độ tưới tự động?',
        answer: 'Trên Dashboard, trong khung "Điều khiển", bật/tắt "Chế độ tự động". Khi bật, hệ thống sẽ tưới khi độ ẩm đất thấp hơn ngưỡng tối thiểu bạn đã cài đặt.',
    },
    {
        id: 'faq-3',
        question: 'Tôi quên mật khẩu đăng nhập?',
        answer: 'Tại trang đăng nhập, nhấn "Quên mật khẩu?" và nhập email đã đăng ký. Bạn sẽ nhận link đặt lại mật khẩu qua email.',
    },
    {
        id: 'faq-4',
        question: 'Làm sao để thay đổi ngưỡng độ ẩm đất?',
        answer: 'Vào Dashboard → khung "Điều khiển", chỉnh "Độ ẩm min" và "Độ ẩm max". Hoặc vào Cài đặt để tùy chỉnh thêm các thông báo liên quan.',
    },
    {
        id: 'faq-5',
        question: 'Thông báo và nhật ký hệ thống khác nhau thế nào?',
        answer: 'Thông báo là các cảnh báo/event gửi tới bạn (độ ẩm thấp, thiết bị offline...). Nhật ký hệ thống là log chi tiết hoạt động backend, dùng khi cần kiểm tra lỗi hoặc debug.',
    },
];

const QUICK_LINKS = [
    { label: 'Dashboard', path: '/dashboard', desc: 'Giám sát và điều khiển' },
    { label: 'Cài đặt', path: '/settings', desc: 'Thông báo và đơn vị' },
    { label: 'Thông báo', path: '/notifications', desc: 'Xem cảnh báo' },
    { label: 'Nhật ký hệ thống', path: '/logs', desc: 'Xem log' },
    { label: 'Profile', path: '/profile', desc: 'Thông tin tài khoản' },
];

export const SupportPage: React.FC = () => {
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                    Hỗ trợ
                </h1>
                <p className="text-slate-500 mt-1">
                    Hướng dẫn và thông tin hữu ích cho người dùng Smart Garden
                </p>
            </div>

            {/* Giới thiệu ngắn */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Về Smart Garden</h2>
                        <p className="text-sm text-slate-500">Hệ thống tưới tiêu thông minh</p>
                    </div>
                </div>
                <div className="p-5 text-sm text-slate-600 space-y-2">
                    <p>
                        Smart Garden giúp bạn giám sát độ ẩm đất, nhiệt độ, ánh sáng và điều khiển tưới tự động
                        hoặc theo lịch. Ứng dụng kết nối với thiết bị ESP32 qua MQTT và hỗ trợ dự báo lượng nước
                        bằng mô hình ML/ANFIS.
                    </p>
                    <p>
                        Sử dụng menu bên trái để điều hướng: Dashboard (tổng quan), Cài đặt (thông báo & đơn vị),
                        Thông báo (cảnh báo), Nhật ký hệ thống (log), và Hỗ trợ (trang này).
                    </p>
                </div>
            </div>

            {/* Câu hỏi thường gặp */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Câu hỏi thường gặp</h2>
                        <p className="text-sm text-slate-500">FAQ</p>
                    </div>
                </div>
                <div className="divide-y divide-slate-100">
                    {FAQ_ITEMS.map((item) => {
                        const isOpen = openFaqId === item.id;
                        return (
                            <div key={item.id} className="border-b border-slate-100 last:border-0">
                                <button
                                    type="button"
                                    onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
                                >
                                    <span className="font-medium text-slate-800">{item.question}</span>
                                    {isOpen ? (
                                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                                    )}
                                </button>
                                {isOpen && (
                                    <div className="px-5 pb-4 pt-0">
                                        <p className="text-sm text-slate-600 pl-0">{item.answer}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Điều hướng nhanh */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Điều hướng nhanh</h2>
                        <p className="text-sm text-slate-500">Các trang chính trong ứng dụng</p>
                    </div>
                </div>
                <div className="p-5">
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {QUICK_LINKS.map((link) => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    className="flex items-center gap-2 p-3 rounded-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors group"
                                >
                                    <span className="font-medium text-slate-800 group-hover:text-teal-600">
                                        {link.label}
                                    </span>
                                    <span className="text-slate-400 text-sm">— {link.desc}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Liên hệ */}
            <div className="bg-white rounded-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="p-2 rounded-sm bg-teal-50" style={{ color: TEAL }}>
                        <Mail className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Liên hệ hỗ trợ</h2>
                        <p className="text-sm text-slate-500">Email và hướng dẫn thêm</p>
                    </div>
                </div>
                <div className="p-5 text-sm text-slate-600 space-y-3">
                    <p>
                        Nếu bạn gặp lỗi kỹ thuật hoặc cần hướng dẫn chi tiết, vui lòng liên hệ qua email
                        với tiêu đề <strong>Smart Garden - Hỗ trợ</strong> và mô tả rõ vấn đề (thiết bị, bước thao tác, ảnh chụp nếu có).
                    </p>
                    <p className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Phản hồi thường trong vòng 1–2 ngày làm việc.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
