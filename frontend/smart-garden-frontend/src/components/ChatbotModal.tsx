import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, Sparkles, ChevronDown, Trash2, ArrowRight } from 'lucide-react';

// ── Category types ────────────────────────────────────────────────────
type Category = 'device' | 'irrigation' | 'ai' | 'weather' | 'account' | 'system';

const CATEGORY_CONFIG: Record<Category, { label: string; emoji: string }> = {
    device:     { label: 'Thiết bị',    emoji: '📡' },
    irrigation: { label: 'Tưới tiêu',  emoji: '💧' },
    ai:         { label: 'AI & Dự đoán', emoji: '🤖' },
    weather:    { label: 'Thời tiết',   emoji: '🌤️' },
    account:    { label: 'Tài khoản',  emoji: '👤' },
    system:     { label: 'Hệ thống',   emoji: '⚙️' },
};

// ── Q&A data ──────────────────────────────────────────────────────────
interface QA {
    id: string;
    question: string;
    answer: string;
    keywords: string[];
    category: Category;
    relatedIds?: string[];
    navPath?: string;
    navLabel?: string;
}

const QA_DATA: QA[] = [
    // ── DEVICE ────────────────────────────────────────────────────────
    {
        id: 'dev-1',
        question: 'Làm sao để thêm thiết bị mới?',
        answer:
            'Để thêm thiết bị mới:\n- Vào **Thiết bị của tôi** → nhấn **"Thêm thiết bị"**\n- Nhập **MAC Address** và **tên thiết bị**\n- Chọn loại cây trồng và loại đất tương ứng\n- Bấm **Lưu** — thiết bị sẽ tự kết nối khi được cấp nguồn và có Wi-Fi.',
        keywords: ['thêm', 'thiết bị', 'device', 'add', 'kết nối', 'mới', 'đăng ký'],
        category: 'device',
        relatedIds: ['dev-2', 'dev-3', 'dev-6'],
        navPath: '/devices',
        navLabel: 'Thiết bị của tôi',
    },
    {
        id: 'dev-2',
        question: 'Thiết bị bị offline, phải làm gì?',
        answer:
            'Khi thiết bị offline, hãy kiểm tra theo thứ tự:\n1. **Nguồn điện** — đảm bảo thiết bị đang được cấp điện\n2. **Wi-Fi** — ESP32 phải kết nối đúng SSID và mật khẩu\n3. **MQTT Broker** — dịch vụ MQTT cần đang chạy\n4. **Cổng mạng** — kiểm tra cổng 1883 không bị tường lửa chặn\n\nSau khi hết sự cố, thiết bị sẽ tự kết nối lại trong vòng **1 phút**.',
        keywords: ['offline', 'mất kết nối', 'không kết nối', 'disconnect', 'sập', 'không hoạt động', 'mất mạng'],
        category: 'device',
        relatedIds: ['dev-1', 'sys-2', 'sys-4'],
        navPath: '/devices',
        navLabel: 'Xem thiết bị',
    },
    {
        id: 'dev-3',
        question: 'Cách xóa hoặc đổi tên thiết bị?',
        answer:
            'Vào **Thiết bị của tôi** → chọn thiết bị cần chỉnh sửa:\n- **Đổi tên**: nhấn biểu tượng ✏️ bên cạnh tên\n- **Xóa thiết bị**: nhấn biểu tượng 🗑️ → xác nhận\n\n⚠️ Xóa thiết bị sẽ không xóa lịch sử dữ liệu đã lưu trước đó.',
        keywords: ['xóa', 'đổi tên', 'rename', 'delete', 'remove', 'chỉnh sửa', 'edit', 'sửa thiết bị'],
        category: 'device',
        relatedIds: ['dev-1', 'dev-4'],
        navPath: '/devices',
        navLabel: 'Thiết bị của tôi',
    },
    {
        id: 'dev-4',
        question: 'Cách cấu hình cây trồng và loại đất?',
        answer:
            'Admin quản lý thư viện tại:\n- **Quản lý → Thư viện cây trồng** — thêm/sửa Kc, độ sâu rễ, giai đoạn sinh trưởng\n- **Quản lý → Thư viện đất** — thêm/sửa WHC, FC, PWP\n\nKhi ghép cây-đất với thiết bị, hệ thống tính toán lượng nước tối ưu theo chuẩn **FAO-56**.',
        keywords: ['cây trồng', 'crop', 'đất', 'soil', 'cấu hình', 'FAO', 'thư viện', 'library', 'kc'],
        category: 'device',
        relatedIds: ['ai-2', 'irr-4', 'dev-5'],
        navPath: '/admin/crop-libraries',
        navLabel: 'Thư viện cây trồng',
    },
    {
        id: 'dev-5',
        question: 'Mùa vụ cây trồng là gì?',
        answer:
            'Mùa vụ (**Crop Season**) là giai đoạn sinh trưởng của cây trên một thiết bị. Mỗi mùa vụ lưu:\n- Loại cây & giai đoạn hiện tại (gieo, phát triển, trưởng thành, thu hoạch)\n- Ngày bắt đầu và kết thúc dự kiến\n- Lịch sử độ ẩm và tưới tiêu\n\nHệ thống dùng dữ liệu mùa vụ để AI hiệu chỉnh dự đoán chính xác hơn theo từng giai đoạn.',
        keywords: ['mùa vụ', 'crop season', 'vụ mùa', 'giai đoạn', 'sinh trưởng', 'season'],
        category: 'device',
        relatedIds: ['dev-4', 'ai-1', 'ai-3'],
    },
    {
        id: 'dev-6',
        question: 'ESP32 firmware hoạt động như thế nào?',
        answer:
            'Firmware ESP32 thực hiện các nhiệm vụ:\n1. **Đọc cảm biến** (đất, nhiệt độ, ánh sáng) mỗi 30 giây\n2. **Gửi MQTT** dữ liệu lên broker → backend nhận và lưu database\n3. **Nhận lệnh tưới** từ backend qua MQTT\n4. **Fuzzy logic local** — kiểm tra an toàn cứng, ngăn tưới quá ngưỡng nguy hiểm\n5. **Chế độ AI** — thực thi lịch tưới do AI service tính toán',
        keywords: ['esp32', 'firmware', 'vi điều khiển', 'arduino', 'phần cứng', 'hardware', 'chip'],
        category: 'device',
        relatedIds: ['sys-2', 'irr-3', 'sys-1'],
    },

    // ── IRRIGATION ────────────────────────────────────────────────────
    {
        id: 'irr-1',
        question: 'Lịch tưới hoạt động như thế nào?',
        answer:
            'Lịch tưới cho phép hẹn giờ tưới tự động:\n- Vào **Cài đặt vườn** → tab **Lịch tưới** → **Tạo lịch mới**\n- Chọn **giờ bắt đầu**, **thời lượng** (phút), **các ngày lặp lại** trong tuần\n- Lịch sẽ kích hoạt bơm đúng giờ, kể cả khi bạn không online',
        keywords: ['lịch', 'schedule', 'tự động', 'hẹn giờ', 'cron', 'thời gian', 'đặt lịch', 'tưới lịch'],
        category: 'irrigation',
        relatedIds: ['irr-2', 'irr-3', 'irr-5'],
        navPath: '/garden-config',
        navLabel: 'Cài đặt vườn',
    },
    {
        id: 'irr-2',
        question: 'Làm sao tưới thủ công ngay lập tức?',
        answer:
            'Để tưới thủ công:\n1. Vào **Dashboard** → tìm khung **"Điều khiển"**\n2. Nhập **thời lượng tưới** (phút)\n3. Nhấn nút **"Tưới ngay"**\n\nLệnh được gửi qua MQTT đến ESP32 trong vài giây. Bạn cũng có thể tưới từ trang **Chi tiết thiết bị**.',
        keywords: ['tưới thủ công', 'manual', 'bơm', 'pump', 'tưới ngay', 'bật bơm', 'mở van'],
        category: 'irrigation',
        relatedIds: ['irr-3', 'irr-1', 'sys-1'],
        navPath: '/dashboard',
        navLabel: 'Dashboard',
    },
    {
        id: 'irr-3',
        question: 'Chế độ tưới tự động (Auto) là gì?',
        answer:
            'Chế độ **Auto** kích hoạt tưới theo ngưỡng độ ẩm đất:\n- Độ ẩm đất < **Moisture Min** → hệ thống tự tưới\n- Độ ẩm đạt **Moisture Max** → dừng tưới\n\nBật tại: **Dashboard → khung Điều khiển → "Chế độ tự động"**\n\nChế độ **AI** nâng cấp hơn — dùng XGBoost + FAO-56 để dự đoán lượng nước tối ưu thay vì ngưỡng cứng, tiết kiệm nước hơn ~20–30%.',
        keywords: ['tự động', 'auto', 'chế độ', 'ngưỡng', 'automatic', 'smart mode', 'bật tự động'],
        category: 'irrigation',
        relatedIds: ['irr-4', 'ai-1', 'ai-4'],
        navPath: '/dashboard',
        navLabel: 'Dashboard',
    },
    {
        id: 'irr-4',
        question: 'Làm sao thay đổi ngưỡng độ ẩm đất?',
        answer:
            'Ngưỡng độ ẩm đất có thể chỉnh tại:\n- **Dashboard** → khung "Điều khiển" → chỉnh **Moisture Min / Max**\n- **Cài đặt vườn** → chọn thiết bị → chỉnh ngưỡng chi tiết\n\nGợi ý theo loại đất:\n- **Đất cát**: min 30%, max 60%\n- **Đất thịt pha cát**: min 40%, max 70%\n- **Đất sét**: min 50%, max 80%',
        keywords: ['ngưỡng', 'độ ẩm', 'moisture', 'min', 'max', 'threshold', 'thay đổi ngưỡng', 'chỉnh'],
        category: 'irrigation',
        relatedIds: ['irr-3', 'dev-4', 'ai-3'],
        navPath: '/garden-config',
        navLabel: 'Cài đặt vườn',
    },
    {
        id: 'irr-5',
        question: 'Xem lịch sử tưới ở đâu?',
        answer:
            'Vào **Lịch sử tưới** từ menu sidebar. Tại đây bạn có thể:\n- **Lọc** theo thiết bị và khoảng thời gian\n- **Xem chi tiết** từng lần tưới: thời lượng, lượng nước (lít), nguồn kích hoạt\n- **Nguồn kích hoạt** gồm: Thủ công, Lịch tự động, AI, Ngưỡng độ ẩm',
        keywords: ['lịch sử', 'history', 'xem lịch sử', 'irrigation log', 'record', 'quá khứ'],
        category: 'irrigation',
        relatedIds: ['irr-1', 'irr-3', 'sys-4'],
        navPath: '/irrigation-history',
        navLabel: 'Lịch sử tưới',
    },

    // ── AI & PREDICTION ───────────────────────────────────────────────
    {
        id: 'ai-1',
        question: 'AI dự đoán tưới tiêu hoạt động ra sao?',
        answer:
            'Hệ thống AI dùng kiến trúc **Hybrid Prediction** hai lớp:\n1. **FAO-56** — mô hình vật lý tính bốc thoát hơi nước (ET₀) làm baseline\n2. **XGBoost ML** — học phần dư giữa thực tế và FAO-56, hiệu chỉnh sai số\n3. **Kết hợp** → dự đoán lượng nước cần tưới trong **24 giờ tới**\n\nModel được retrain hàng tuần với dữ liệu mới, ngày càng chính xác theo điều kiện địa phương.',
        keywords: ['AI', 'dự đoán', 'prediction', 'ML', 'machine learning', 'XGBoost', 'model', 'trí tuệ nhân tạo', 'hybrid'],
        category: 'ai',
        relatedIds: ['ai-2', 'ai-3', 'ai-4'],
        navPath: '/automation/predictions',
        navLabel: 'Xem dự đoán AI',
    },
    {
        id: 'ai-2',
        question: 'FAO-56 và Water Balance là gì?',
        answer:
            '**FAO-56** là tiêu chuẩn quốc tế tính nhu cầu nước cây trồng. Các thành phần chính:\n- **ET₀** — bốc thoát hơi tham chiếu (dựa trên nhiệt độ, gió, ẩm, bức xạ)\n- **Kc** — hệ số cây trồng theo giai đoạn sinh trưởng\n- **RAW** — lượng nước hữu ích sẵn sàng trong đất\n\n**Water Balance** theo dõi lượng nước trong tầng rễ, tự động tính khi nào cần tưới bổ sung và bao nhiêu.',
        keywords: ['FAO', 'FAO-56', 'water balance', 'ET0', 'evapotranspiration', 'bốc hơi', 'Kc', 'RAW'],
        category: 'ai',
        relatedIds: ['ai-1', 'ai-3', 'dev-4'],
    },
    {
        id: 'ai-3',
        question: 'Xem kết quả dự đoán AI ở đâu?',
        answer:
            'Vào **Tự động hóa → Dự đoán ML**. Tại đây hiển thị:\n- **Lượng nước dự đoán** cho 24h tới (mm và lít)\n- **Độ chính xác model** (R², RMSE)\n- **Phân tích đóng góp** FAO-56 vs ML\n- **Biểu đồ** dự báo theo giờ\n\nKết quả cập nhật mỗi **1 giờ** khi backend gọi AI service.',
        keywords: ['dự đoán', 'prediction', 'kết quả', 'xem dự đoán', 'biểu đồ', 'R2', 'RMSE', 'accuracy', 'chart'],
        category: 'ai',
        relatedIds: ['ai-1', 'ai-2', 'ai-4'],
        navPath: '/automation/predictions',
        navLabel: 'Xem Predictions',
    },
    {
        id: 'ai-4',
        question: 'Chế độ AI tưới khác chế độ Auto thế nào?',
        answer:
            'So sánh hai chế độ:\n- **Auto**: quyết định theo ngưỡng độ ẩm cứng, lượng nước cố định, không thích nghi\n- **AI**: quyết định theo dự đoán XGBoost + FAO-56, lượng nước tối ưu theo thời tiết, tự học và cải thiện\n\nChế độ AI tiết kiệm nước hơn ~**20–30%** nhờ tính đúng nhu cầu thực tế và dự báo mưa.',
        keywords: ['AI mode', 'chế độ AI', 'so sánh', 'khác nhau', 'auto vs AI', 'tiết kiệm nước', 'tốt hơn'],
        category: 'ai',
        relatedIds: ['ai-1', 'irr-3', 'irr-4'],
    },

    // ── WEATHER ───────────────────────────────────────────────────────
    {
        id: 'wthr-1',
        question: 'Dữ liệu thời tiết lấy từ đâu?',
        answer:
            'Hệ thống tích hợp **OpenWeatherMap API** để lấy:\n- Thời tiết hiện tại (nhiệt độ, độ ẩm, gió, mưa)\n- **Dự báo 5 ngày** theo từng giờ\n- **Bức xạ mặt trời** cho tính toán ET₀ trong FAO-56\n\nWidget thời tiết trên **Dashboard** cập nhật mỗi **30 phút**.',
        keywords: ['thời tiết', 'weather', 'OpenWeather', 'dự báo', 'forecast', 'nhiệt độ', 'mưa', 'API'],
        category: 'weather',
        relatedIds: ['wthr-2', 'wthr-3', 'ai-2'],
        navPath: '/dashboard',
        navLabel: 'Xem Dashboard',
    },
    {
        id: 'wthr-2',
        question: 'Mưa ảnh hưởng thế nào đến lịch tưới?',
        answer:
            'Tùy chế độ đang dùng:\n- **AI mode**: tự động giảm lượng nước tưới — mưa được tính vào water balance, tránh tưới dư thừa\n- **Auto mode**: không tự điều chỉnh theo mưa\n- **Lịch cố định**: không điều chỉnh theo thời tiết\n\nKhuyến nghị dùng chế độ **AI** để tối ưu nước khi có mưa.',
        keywords: ['mưa', 'rain', 'rainfall', 'dự báo mưa', 'điều chỉnh', 'skip', 'bỏ qua mưa'],
        category: 'weather',
        relatedIds: ['wthr-1', 'ai-4', 'irr-3'],
    },
    {
        id: 'wthr-3',
        question: 'Widget thời tiết hiển thị thông tin gì?',
        answer:
            'Widget thời tiết trên Dashboard hiển thị:\n- 🌡️ **Nhiệt độ** hiện tại và cảm nhận\n- 💧 **Độ ẩm không khí** (%)\n- 💨 **Tốc độ và hướng gió** (m/s)\n- 🌧️ **Xác suất và lượng mưa** (mm)\n- ☀️ **Chỉ số UV** và **bức xạ mặt trời**\n- 📅 **Dự báo 5 ngày** tổng quan',
        keywords: ['widget', 'weather widget', 'hiển thị thời tiết', 'UV', 'gió', 'độ ẩm không khí', 'thông tin thời tiết'],
        category: 'weather',
        relatedIds: ['wthr-1', 'wthr-2', 'sys-1'],
        navPath: '/dashboard',
        navLabel: 'Dashboard',
    },

    // ── ACCOUNT ───────────────────────────────────────────────────────
    {
        id: 'acc-1',
        question: 'Tôi quên mật khẩu, phải làm sao?',
        answer:
            'Đặt lại mật khẩu theo các bước:\n1. Tại trang **Đăng nhập** → nhấn **"Quên mật khẩu?"**\n2. Nhập **email đã đăng ký**\n3. Kiểm tra hộp thư đến (và thư mục Spam)\n4. Nhấn link và nhập mật khẩu mới\n\nLink đặt lại có hiệu lực trong **24 giờ**.',
        keywords: ['quên', 'mật khẩu', 'password', 'reset', 'đặt lại', 'forgot', 'không đăng nhập được'],
        category: 'account',
        relatedIds: ['acc-2', 'acc-3'],
    },
    {
        id: 'acc-2',
        question: 'Cách đổi thông tin tài khoản?',
        answer:
            'Vào **Profile** để chỉnh sửa:\n- **Họ tên, số điện thoại, địa chỉ**\n- **Ảnh đại diện**\n- **Mật khẩu** (cần nhập mật khẩu cũ để xác nhận)\n\nNhấn **"Lưu thay đổi"** sau khi cập nhật.',
        keywords: ['profile', 'tài khoản', 'account', 'đổi thông tin', 'thay đổi', 'chỉnh sửa tài khoản', 'tên', 'ảnh đại diện'],
        category: 'account',
        relatedIds: ['acc-1', 'acc-3'],
        navPath: '/profile',
        navLabel: 'Profile',
    },
    {
        id: 'acc-3',
        question: 'Sự khác nhau giữa Admin và User?',
        answer:
            '**Admin** có quyền:\n- Quản lý tất cả người dùng và thiết bị\n- Quản lý thư viện cây trồng / đất\n- Xem system logs toàn hệ thống\n\n**User thường** chỉ:\n- Quản lý thiết bị của mình\n- Xem dashboard, lịch sử tưới\n- Tạo và chỉnh lịch tưới',
        keywords: ['admin', 'user', 'phân quyền', 'quyền', 'role', 'permission', 'khác nhau admin user'],
        category: 'account',
        relatedIds: ['acc-2', 'sys-4'],
    },

    // ── SYSTEM ────────────────────────────────────────────────────────
    {
        id: 'sys-1',
        question: 'Dữ liệu cảm biến cập nhật bao lâu một lần?',
        answer:
            'Chu kỳ cập nhật của từng loại dữ liệu:\n- **Cảm biến đất** (độ ẩm, nhiệt độ, ánh sáng): mỗi **30 giây**\n- **Thời tiết** (OpenWeatherMap): mỗi **30 phút**\n- **Dự đoán AI**: mỗi **1 giờ**\n\nXem dữ liệu realtime tại trang **Giám sát**.',
        keywords: ['cảm biến', 'sensor', 'cập nhật', 'dữ liệu', 'realtime', 'tần suất', 'bao lâu', 'update'],
        category: 'system',
        relatedIds: ['sys-2', 'wthr-3', 'irr-3'],
        navPath: '/monitoring',
        navLabel: 'Trang Giám sát',
    },
    {
        id: 'sys-2',
        question: 'MQTT là gì và dùng để làm gì?',
        answer:
            '**MQTT** là giao thức nhắn tin IoT nhẹ, dùng để:\n- **ESP32 → Backend**: gửi dữ liệu cảm biến thời gian thực\n- **Backend → ESP32**: gửi lệnh tưới\n\nTopic format:\n- `garden/{deviceId}/sensor` — data cảm biến\n- `garden/{deviceId}/command` — lệnh từ server\n\nBroker MQTT mặc định chạy tại cổng **1883**.',
        keywords: ['MQTT', 'broker', 'IoT', 'giao thức', 'protocol', 'topic', 'publish', 'subscribe', 'message queue'],
        category: 'system',
        relatedIds: ['dev-6', 'sys-1', 'dev-2'],
    },
    {
        id: 'sys-3',
        question: 'Tôi không nhận được thông báo?',
        answer:
            'Kiểm tra theo thứ tự:\n1. **Cài đặt → Thông báo** — đảm bảo loại thông báo cần thiết đã được bật\n2. **Trình duyệt** — đã cho phép notifications từ trang web chưa?\n3. **Hộp thư Spam** — nếu dùng thông báo email\n\nHệ thống gửi thông báo khi: thiết bị offline, độ ẩm đất bất thường, hoàn thành tưới, cảnh báo AI.',
        keywords: ['thông báo', 'notification', 'không nhận', 'không thấy', 'alert', 'push notification', 'email'],
        category: 'system',
        relatedIds: ['sys-5', 'dev-2'],
        navPath: '/settings',
        navLabel: 'Cài đặt',
    },
    {
        id: 'sys-4',
        question: 'Làm sao xem nhật ký hệ thống (System Logs)?',
        answer:
            'Vào **Nhật ký hệ thống** từ menu sidebar (chỉ dành cho **Admin**).\n\nTại đây có thể xem:\n- **Backend logs**: request, response, errors\n- **MQTT events**: kết nối, ngắt kết nối, publish\n- **AI service calls**: prediction requests và kết quả\n- Lọc theo **mức độ** (INFO, WARN, ERROR) và **khoảng thời gian**',
        keywords: ['log', 'nhật ký', 'system log', 'debug', 'error log', 'xem log', 'backend log', 'admin log'],
        category: 'system',
        relatedIds: ['sys-2', 'acc-3', 'sys-3'],
        navPath: '/logs',
        navLabel: 'System Logs',
    },
    {
        id: 'sys-5',
        question: 'Cách bật/tắt và tùy chỉnh thông báo?',
        answer:
            'Vào **Cài đặt → Thông báo**. Bạn có thể:\n- Bật/tắt từng loại thông báo riêng lẻ\n- Chọn kênh nhận: **trong app** hoặc **email**\n\nCác loại thông báo:\n- 🔴 Thiết bị offline\n- 🟡 Độ ẩm đất quá thấp / quá cao\n- 🟢 Hoàn thành tưới tự động\n- ⚠️ Cảnh báo AI / thời tiết',
        keywords: ['thông báo', 'notification', 'bật tắt', 'tùy chỉnh', 'cài đặt thông báo', 'DND', 'email notification'],
        category: 'system',
        relatedIds: ['sys-3', 'acc-2'],
        navPath: '/settings',
        navLabel: 'Cài đặt',
    },
];

// ── Fallback responses ─────────────────────────────────────────────
const FALLBACKS = [
    'Mình chưa tìm được câu trả lời phù hợp 😅. Hãy thử chọn một gợi ý bên dưới, hoặc vào trang **Hỗ trợ** nhé!',
    'Câu hỏi này nằm ngoài phạm vi của mình rồi 🤔. Bạn thử đặt lại bằng từ khóa khác, hoặc chọn câu gợi ý bên dưới!',
    'Mình chưa có thông tin về điều đó 😊. Thử chọn câu hỏi gợi ý hoặc vào trang **Hỗ trợ** để liên hệ trực tiếp nhé!',
];

// ── Types ─────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
    relatedIds?: string[];
    navPath?: string;
    navLabel?: string;
}

const STORAGE_KEY = 'chatbot_messages_v2';

// ── Resize constraints ────────────────────────────────────────────────
const MIN_W = 320;
const MAX_W = 680;
const MIN_H = 380;
const MAX_H = 780;
const DEFAULT_W = 420;
const DEFAULT_H = 580;

// ── Helpers ────────────────────────────────────────────────────────────
function findBestMatch(input: string): { answer: string; relatedIds?: string[]; navPath?: string; navLabel?: string } {
    const lower = input.toLowerCase();
    let bestMatch: QA | null = null;
    let bestScore = 0;

    for (const qa of QA_DATA) {
        let score = 0;
        for (const kw of qa.keywords) {
            if (lower.includes(kw.toLowerCase())) {
                // Weight by number of words in keyword phrase
                score += kw.trim().split(/\s+/).length;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = qa;
        }
    }

    if (bestMatch && bestScore >= 1) {
        return {
            answer: bestMatch.answer,
            relatedIds: bestMatch.relatedIds,
            navPath: bestMatch.navPath,
            navLabel: bestMatch.navLabel,
        };
    }

    return { answer: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] };
}

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function getQAById(id: string): QA | undefined {
    return QA_DATA.find((q) => q.id === id);
}

// ── Enhanced Markdown renderer ─────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = (key: string) => {
        if (listBuffer.length === 0) return;
        if (listType === 'ul') {
            result.push(<ul key={key} className="list-disc list-outside pl-4 space-y-0.5">{listBuffer}</ul>);
        } else {
            result.push(<ol key={key} className="list-decimal list-outside pl-4 space-y-0.5">{listBuffer}</ol>);
        }
        listBuffer = [];
        listType = null;
    };

    lines.forEach((line, i) => {
        const bulletMatch = line.match(/^[-•]\s+(.*)/);
        const orderedMatch = line.match(/^\d+\.\s+(.*)/);

        if (bulletMatch) {
            if (listType === 'ol') flushList(`fl-${i}`);
            listType = 'ul';
            listBuffer.push(<li key={i}>{renderInline(bulletMatch[1])}</li>);
        } else if (orderedMatch) {
            if (listType === 'ul') flushList(`fl-${i}`);
            listType = 'ol';
            listBuffer.push(<li key={i}>{renderInline(orderedMatch[1])}</li>);
        } else {
            flushList(`fl-${i}`);
            if (line.trim() === '') {
                result.push(<div key={i} className="h-1" />);
            } else {
                result.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
            }
        }
    });
    flushList('fl-end');

    return <div className="space-y-1">{result}</div>;
}

function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

// ── Component ────────────────────────────────────────────────────────
const WELCOME_MSG: ChatMessage = {
    id: 'welcome',
    role: 'bot',
    text: 'Xin chào! 👋 Mình là trợ lý **Smart Garden**. Hỏi mình bất cứ điều gì về hệ thống, hoặc chọn một câu hỏi gợi ý bên dưới nhé!',
    timestamp: new Date(),
};

function loadMessages(): ChatMessage[] {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [WELCOME_MSG];
        const parsed = JSON.parse(raw) as ChatMessage[];
        return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
        return [WELCOME_MSG];
    }
}

export const ChatbotModal: React.FC = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
    const [chatSize, setChatSize] = useState(() => ({
        w: typeof window !== 'undefined' ? Math.min(DEFAULT_W, window.innerWidth - 48) : DEFAULT_W,
        h: DEFAULT_H,
    }));

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

    // Persist messages to session storage
    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, [messages]);

    // Global mouse handlers for resize drag
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const newW = Math.min(MAX_W, Math.max(MIN_W, dragStart.current.w + (dragStart.current.x - e.clientX)));
            const newH = Math.min(MAX_H, Math.max(MIN_H, dragStart.current.h + (dragStart.current.y - e.clientY)));
            setChatSize({ w: newW, h: newH });
        };
        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    const onResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY, w: chatSize.w, h: chatSize.h };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'nw-resize';
    };

    // Auto-scroll on new message / typing change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const handleScroll = useCallback(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const clearChat = () => {
        setMessages([WELCOME_MSG]);
        sessionStorage.removeItem(STORAGE_KEY);
    };

    const sendMessage = useCallback((text: string) => {
        if (!text.trim() || isTyping) return;

        const userMsg: ChatMessage = {
            id: uid(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        setTimeout(() => {
            const result = findBestMatch(text);
            const botMsg: ChatMessage = {
                id: uid(),
                role: 'bot',
                text: result.answer,
                timestamp: new Date(),
                relatedIds: result.relatedIds,
                navPath: result.navPath,
                navLabel: result.navLabel,
            };
            setIsTyping(false);
            setMessages((prev) => [...prev, botMsg]);
        }, 500 + Math.random() * 500);
    }, [isTyping]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    const filteredQA = activeCategory === 'all'
        ? QA_DATA
        : QA_DATA.filter((qa) => qa.category === activeCategory);

    const categoryEntries = Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][];

    return (
        <>
            {/* ── Floating Action Button ───────────────────────── */}
            <button
                id="chatbot-fab"
                onClick={() => setIsOpen((o) => !o)}
                className="fixed bottom-6 right-6 z-50 cursor-pointer"
                aria-label="Mở chatbot"
            >
                <span className="absolute inset-0 rounded-full bg-teal-400/30 animate-ping" />
                <span
                    className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg
                    bg-gradient-to-br from-teal-500 to-emerald-600
                    hover:from-teal-400 hover:to-emerald-500
                    transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-teal-500/25"
                >
                    {isOpen
                        ? <X className="w-6 h-6 text-white" />
                        : <MessageCircle className="w-6 h-6 text-white" />
                    }
                </span>
            </button>

            {/* ── Chat Window ──────────────────────────────────── */}
            {isOpen && (
                <div
                    className="fixed z-50 chat-slide-up bottom-24 right-6 flex flex-col rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl shadow-black/10"
                    style={{ width: chatSize.w, height: chatSize.h }}
                >
                    {/* ── Resize handle — drag from top-left corner ── */}
                    <div
                        onMouseDown={onResizeMouseDown}
                        className="absolute top-0 left-0 w-6 h-6 z-20 cursor-nw-resize select-none group"
                        title="Kéo để thay đổi kích thước"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" className="absolute top-1.5 left-1.5 opacity-40 group-hover:opacity-80 transition-opacity">
                            <line x1="1" y1="9" x2="9" y2="1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                            <line x1="1" y1="5" x2="5" y2="1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    </div>
                    {/* ─── Header ────────────────────────────────── */}
                    <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white shrink-0">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-tight">Smart Garden Assistant</h3>
                            <p className="text-[11px] text-teal-100 flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block animate-pulse" />
                                {QA_DATA.length} chủ đề hỗ trợ
                            </p>
                        </div>
                        {/* Clear chat */}
                        <button
                            onClick={clearChat}
                            title="Xóa hội thoại"
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                            aria-label="Xóa hội thoại"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                            aria-label="Đóng chatbot"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ─── Messages ──────────────────────────────── */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-gradient-to-b from-slate-50/80 to-white/80"
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex chat-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'bot' && (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-white" />
                                    </div>
                                )}

                                <div className="max-w-[82%] flex flex-col gap-2">
                                    {/* Bubble */}
                                    <div
                                        className={`px-3.5 py-2.5 rounded-2xl text-[13px] shadow-sm ${
                                            msg.role === 'user'
                                                ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-br-md'
                                                : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md'
                                        }`}
                                    >
                                        {renderMarkdown(msg.text)}
                                    </div>

                                    {/* Navigation button */}
                                    {msg.role === 'bot' && msg.navPath && msg.navLabel && (
                                        <button
                                            onClick={() => { navigate(msg.navPath!); setIsOpen(false); }}
                                            className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium
                                            rounded-lg bg-teal-500 text-white hover:bg-teal-600
                                            transition-colors cursor-pointer shadow-sm"
                                        >
                                            <ArrowRight className="w-3 h-3" />
                                            {msg.navLabel}
                                        </button>
                                    )}

                                    {/* Related questions */}
                                    {msg.role === 'bot' && msg.relatedIds && msg.relatedIds.length > 0 && (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-slate-400 font-medium">Câu hỏi liên quan:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {msg.relatedIds.map((rid) => {
                                                    const qa = getQAById(rid);
                                                    if (!qa) return null;
                                                    return (
                                                        <button
                                                            key={rid}
                                                            onClick={() => sendMessage(qa.question)}
                                                            className="px-2.5 py-1 text-[11px] font-medium rounded-full
                                                            border border-slate-200 text-slate-600 bg-slate-50
                                                            hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50
                                                            transition-all cursor-pointer"
                                                        >
                                                            {qa.question}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
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

                    {/* Scroll-to-bottom button */}
                    {showScrollBtn && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-[148px] left-1/2 -translate-x-1/2
                            w-8 h-8 rounded-full bg-white shadow-md border border-slate-200
                            flex items-center justify-center hover:bg-slate-50 transition-all cursor-pointer chat-fade-in"
                        >
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                    )}

                    {/* ─── Quick Questions ────────────────────────── */}
                    <div className="border-t border-slate-100 bg-white/90 shrink-0">
                        {/* Category tabs */}
                        <div className="flex gap-1.5 px-3 pt-2.5 pb-1 overflow-x-auto scrollbar-none">
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all cursor-pointer ${
                                    activeCategory === 'all'
                                        ? 'bg-teal-500 text-white border-teal-500'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
                                }`}
                            >
                                Tất cả
                            </button>
                            {categoryEntries.map(([cat, cfg]) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                                        activeCategory === cat
                                            ? 'bg-teal-500 text-white border-teal-500'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
                                    }`}
                                >
                                    {cfg.emoji} {cfg.label}
                                </button>
                            ))}
                        </div>
                        {/* Question chips */}
                        <div className="px-3 pb-2.5 max-h-[108px] overflow-y-auto">
                            <div className="flex flex-wrap gap-1.5">
                                {filteredQA.map((qa) => (
                                    <button
                                        key={qa.id}
                                        onClick={() => sendMessage(qa.question)}
                                        className="px-3 py-1.5 text-[11px] font-medium rounded-full
                                        border border-teal-200 text-teal-700 bg-teal-50/80
                                        hover:bg-teal-100 hover:border-teal-300
                                        transition-all duration-200 cursor-pointer"
                                    >
                                        {qa.question}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ─── Input ──────────────────────────────────── */}
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
                            transition-all duration-200 placeholder:text-slate-400"
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
