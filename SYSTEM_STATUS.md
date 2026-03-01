# Trạng thái hệ thống Smart Garden

## Tóm tắt

| Thành phần | Trạng thái | Ghi chú |
|------------|------------|---------|
| **Backend (Spring Boot)** | ✅ Compile OK | Chạy được khi có MySQL |
| **Frontend (React/Vite)** | ⚠️ Build lỗi TypeScript | `npm run dev` có thể vẫn chạy; `npm run build` fail |
| **Kết nối FE–BE** | ✅ Cấu hình đúng | Frontend gọi `http://localhost:8081/api` |

---

## Backend

- **Compile:** `mvn compile` thành công.
- **Chạy:** Cần **MySQL** (port 3307, DB `smart_irrigation`, user/pass trong `application.properties`).  
  Nếu không có MySQL, backend sẽ không start được.
- **Tùy chọn:**
  - **MQTT (Mosquitto)** port 1883: cho tính năng thiết bị ESP32. Dùng `docker compose -f docker-compose.mqtt.yml up -d`.
  - **AI service** (Python FastAPI) port 5000: cho dự báo ML. Cấu hình trong `application.properties`.
- **Profile:** Đang dùng `spring.profiles.active=local`; file `application-local.properties` (SMTP, v.v.) cần tồn tại nếu có tham chiếu.

---

## Frontend

- **Build:** `npm run build` (tsc + vite build) **đang fail** do nhiều lỗi TypeScript:
  - Unused imports / biến (Sidebar, TopNavbar, DeviceMap, …)
  - Sai kiểu (Recharts formatter, DeviceStatus, SoilLibrary so sánh number/string, …)
  - Hook `useOptimisticMutation` sai kiểu query key (string vs readonly unknown[])
  - Thiếu property (SoilLibraryListItem.updatedAt), v.v.
- **Dev:** `npm run dev` thường vẫn chạy (Vite có thể không bật strict type-check), nên có thể dùng để test.
- **Đã sửa:** Thêm import `toast` trong `SoilLibraryPage.tsx` (tránh lỗi runtime khi tạo/sửa bản ghi).

Để **build production thành công**, cần xử lý hết các lỗi TypeScript (khoảng 40+ chỗ) trong:
- `IrrigationChart.tsx`, `DeviceMap.tsx`, `Header.tsx`, `Sidebar.tsx`, `TopNavbar.tsx`, `WeatherWidget.tsx`
- `useOptimisticMutation.ts`, `smartGardenMocks.ts`
- `AdminDevicesPage.tsx`, `CropLibraryPage.tsx`, `DashboardPage.tsx`, `DevicesPage.tsx`
- `IrrigationConfigPage.tsx`, `PredictionsPage.tsx`, `SoilLibraryPage.tsx`

---

## Chạy hệ thống (gợi ý)

1. **MySQL:** Khởi động MySQL trên port 3307, tạo DB `smart_irrigation` (hoặc dùng `createDatabaseIfNotExist=true` như trong config).
2. **Backend:**  
   `cd backend/smart-garden` → `mvn spring-boot:run`
3. **Frontend:**  
   `cd frontend/smart-garden-frontend` → `npm run dev`  
   (Nếu cần build production thì phải sửa hết lỗi TS trước.)
4. **Tùy chọn:**  
   - MQTT: `docker compose -f docker-compose.mqtt.yml up -d`  
   - AI: chạy ai-service theo hướng dẫn trong `ai-service/`.

---

## Kết luận

- **Backend:** Hoạt động đầy đủ khi MySQL sẵn sàng; MQTT và AI là tùy chọn theo tính năng.
- **Frontend:** Logic và giao diện đủ để dùng trong dev, nhưng **chưa đạt “đầy đủ”** ở mức build production do còn nhiều lỗi TypeScript. Nên sửa dần theo danh sách file ở trên để hệ thống build và deploy ổn định.
