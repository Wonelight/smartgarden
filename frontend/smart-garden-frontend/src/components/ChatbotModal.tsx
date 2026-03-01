import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, ChevronDown } from 'lucide-react';

// ── Predefined Q&A data ────────────────────────────────────────────
interface QA {
    question: string;
    answer: string;
    keywords: string[];
}

const QA_DATA: QA[] = [
    {
        question: 'Làm sao để thêm thiết bị mới?',
        answer:
            'Để thêm thiết bị mới, hãy vào trang **Thiết bị của tôi** → nhấn nút **"Thêm thiết bị"**. Nhập thông tin MAC Address và tên thiết bị, sau đó bấm Lưu. Thiết bị sẽ tự động kết nối khi được cấp nguồn và có Wi-Fi.',
        keywords: ['thêm', 'thiết bị', 'device', 'add', 'kết nối', 'mới'],
    },
    {
        question: 'Lịch tưới hoạt động như thế nào?',
        answer:
            'Lịch tưới cho phép bạn đặt thời gian tưới tự động hàng ngày hoặc theo ngày trong tuần. Vào **Tự động hóa → Lịch tưới** để tạo lịch mới. Bạn có thể chọn giờ bắt đầu, thời lượng tưới, và các ngày lặp lại.',
        keywords: ['lịch', 'tưới', 'schedule', 'tự động', 'hẹn giờ'],
    },
    {
        question: 'Dữ liệu cảm biến cập nhật bao lâu một lần?',
        answer:
            'Dữ liệu cảm biến (nhiệt độ, độ ẩm đất, ánh sáng, v.v.) được cập nhật **mỗi 30 giây** từ thiết bị ESP32 qua giao thức MQTT. Bạn có thể xem dữ liệu realtime tại trang **Giám sát**.',
        keywords: ['cảm biến', 'sensor', 'cập nhật', 'data', 'dữ liệu', 'realtime', 'thời gian'],
    },
    {
        question: 'AI dự đoán tưới tiêu hoạt động ra sao?',
        answer:
            'Hệ thống sử dụng mô hình **XGBoost** và **ANFIS** để dự đoán lượng nước cần tưới dựa trên dữ liệu thời tiết, độ ẩm đất, loại cây trồng và lịch sử tưới. Kết quả dự đoán hiển thị tại **Tự động hóa → Dự đoán ML & Fuzzy**.',
        keywords: ['AI', 'dự đoán', 'prediction', 'ML', 'machine learning', 'ANFIS', 'XGBoost', 'model'],
    },
    {
        question: 'Làm sao để xem lịch sử tưới?',
        answer:
            'Vào trang **Lịch sử tưới** từ menu bên trái. Tại đây bạn có thể lọc theo thiết bị, khoảng thời gian, và xem chi tiết từng lần tưới bao gồm thời lượng, lượng nước, và nguồn kích hoạt (thủ công / tự động / AI).',
        keywords: ['lịch sử', 'history', 'tưới', 'xem', 'irrigation'],
    },
    {
        question: 'Thông báo được gửi khi nào?',
        answer:
            'Hệ thống gửi thông báo khi: 🔴 Thiết bị mất kết nối, 🟡 Độ ẩm đất quá thấp, 🟢 Hoàn thành tưới tự động, ⚠️ Cảnh báo thời tiết bất thường. Bạn có thể tùy chỉnh tại trang **Cài đặt → Thông báo**.',
        keywords: ['thông báo', 'notification', 'cảnh báo', 'alert', 'gửi'],
    },
    {
        question: 'Cách cấu hình cây trồng và loại đất?',
        answer:
            'Admin có thể quản lý thư viện cây trồng và loại đất tại **Quản lý → Thư viện cây trồng / Thư viện đất**. Khi thêm thiết bị, bạn chọn loại cây và đất phù hợp để hệ thống tính toán lượng nước tối ưu theo tiêu chuẩn FAO-56.',
        keywords: ['cây trồng', 'crop', 'đất', 'soil', 'cấu hình', 'config', 'FAO'],
    },
    {
        question: 'Dữ liệu thời tiết lấy từ đâu?',
        answer:
            'Hệ thống tích hợp **OpenWeatherMap API** để lấy dữ liệu thời tiết hiện tại và dự báo 5 ngày. Dữ liệu bao gồm nhiệt độ, độ ẩm không khí, tốc độ gió, lượng mưa, và bức xạ mặt trời – hiển thị trên widget thời tiết ở Dashboard.',
        keywords: ['thời tiết', 'weather', 'OpenWeather', 'dự báo', 'forecast', 'nhiệt độ', 'mưa'],
    },
];

// ── Types ────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────
function findAnswer(input: string): string {
    const lower = input.toLowerCase();
    let bestMatch: QA | null = null;
    let bestScore = 0;

    for (const qa of QA_DATA) {
        let score = 0;
        for (const kw of qa.keywords) {
            if (lower.includes(kw.toLowerCase())) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = qa;
        }
    }

    if (bestMatch && bestScore >= 1) return bestMatch.answer;

    return 'Xin lỗi, mình chưa hiểu câu hỏi của bạn 😅. Hãy thử chọn một trong những câu hỏi gợi ý bên dưới, hoặc liên hệ **Hỗ trợ** để được giúp đỡ nhé!';
}

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

// ── Markdown-lite renderer (bold only) ───────────────────────────────
function renderMarkdownLite(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="font-semibold">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

// ── Component ────────────────────────────────────────────────────────
export const ChatbotModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'bot',
            text: 'Xin chào! 👋 Mình là trợ lý Smart Garden. Bạn có thể hỏi mình về hệ thống tưới tiêu thông minh, hoặc chọn một câu hỏi bên dưới nhé!',
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll on new message
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Track scroll position
    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 80;
        setShowScrollBtn(!isNearBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = (text: string) => {
        if (!text.trim()) return;

        const userMsg: ChatMessage = {
            id: uid(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // Simulate typing delay
        setTimeout(() => {
            const answer = findAnswer(text);
            const botMsg: ChatMessage = {
                id: uid(),
                role: 'bot',
                text: answer,
                timestamp: new Date(),
            };
            setIsTyping(false);
            setMessages((prev) => [...prev, botMsg]);
        }, 600 + Math.random() * 400);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    const handleQuickQuestion = (q: string) => {
        sendMessage(q);
    };

    return (
        <>
            {/* ── Floating Action Button ─────────────────────────── */}
            <button
                id="chatbot-fab"
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 group cursor-pointer"
                aria-label="Mở chatbot"
            >
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full bg-teal-400/30 animate-ping" />
                {/* Button body */}
                <span
                    className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg
                    bg-gradient-to-br from-teal-500 to-emerald-600
                    hover:from-teal-400 hover:to-emerald-500
                    transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-teal-500/25"
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-white transition-transform duration-200" />
                    ) : (
                        <MessageCircle className="w-6 h-6 text-white transition-transform duration-200" />
                    )}
                </span>
            </button>


            {/* ── Chat Window ────────────────────────────────────── */}
            {isOpen && (
                <div
                    className="fixed z-50 chat-slide-up
                    bottom-24 right-6
                    w-[calc(100vw-3rem)] sm:w-[400px]
                    max-h-[min(75vh,600px)]
                    flex flex-col
                    rounded-2xl overflow-hidden
                    bg-white/95 backdrop-blur-xl
                    border border-white/60
                    shadow-2xl shadow-black/10"
                >
                    {/* ─── Header ─────────────────────────────────── */}
                    <div
                        className="flex items-center gap-3 px-5 py-4
                        bg-gradient-to-r from-teal-500 to-emerald-600
                        text-white shrink-0"
                    >
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-tight">
                                Smart Garden Assistant
                            </h3>
                            <p className="text-[11px] text-teal-100 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block animate-pulse" />
                                Luôn sẵn sàng hỗ trợ
                            </p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                            aria-label="Đóng chatbot"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ─── Messages ────────────────────────────────── */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0
                        bg-gradient-to-b from-slate-50/80 to-white/80"
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} chat-fade-in`}
                            >
                                {msg.role === 'bot' && (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-br-md'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md'
                                        }`}
                                >
                                    {renderMarkdownLite(msg.text)}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="flex justify-start chat-fade-in">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                                    <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full chat-typing-dot" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full chat-typing-dot" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full chat-typing-dot" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll-to-bottom FAB */}
                    {showScrollBtn && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-[140px] left-1/2 -translate-x-1/2
                            w-8 h-8 rounded-full bg-white shadow-md border border-slate-200
                            flex items-center justify-center
                            hover:bg-slate-50 transition-all cursor-pointer chat-fade-in"
                        >
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                    )}

                    {/* ─── Quick Questions ─────────────────────────── */}
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-white/90 shrink-0 max-h-[140px] overflow-y-auto">
                        <div className="flex flex-wrap gap-1.5">
                            {QA_DATA.map((qa, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickQuestion(qa.question)}
                                    className="px-3 py-1.5 text-[11px] font-medium
                                    rounded-full border border-teal-200 text-teal-700
                                    bg-teal-50/80 hover:bg-teal-100 hover:border-teal-300
                                    transition-all duration-200 cursor-pointer"
                                >
                                    {qa.question}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ─── Input ───────────────────────────────────── */}
                    <form
                        onSubmit={handleSubmit}
                        className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-white shrink-0"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Nhập câu hỏi của bạn..."
                            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200
                            rounded-xl outline-none
                            focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20
                            transition-all duration-200
                            placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isTyping}
                            className="p-2.5 rounded-xl
                            bg-gradient-to-br from-teal-500 to-emerald-600
                            text-white shadow-sm
                            hover:from-teal-400 hover:to-emerald-500 hover:shadow-md
                            disabled:opacity-40 disabled:cursor-not-allowed
                            transition-all duration-200 cursor-pointer"
                            aria-label="Gửi tin nhắn"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};
