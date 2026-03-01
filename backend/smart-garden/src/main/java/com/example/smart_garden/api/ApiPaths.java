package com.example.smart_garden.api;

/**
 * Định nghĩa chung đường dẫn API.
 * Dùng cho Controller (@RequestMapping, @GetMapping, ...) và Security
 * (permitAll, requestMatchers).
 * <p>
 * Quy ước: context-path có thể là /api hoặc rỗng; các path dưới đây là path đầy
 * đủ
 * khi context-path rỗng (ví dụ /api/devices). Nếu context-path=/api thì
 * controller
 * nên dùng BASE = "/api" để mapping trùng với constant.
 */
public final class ApiPaths {

    private ApiPaths() {
    }

    /**
     * Base path cho REST API (devices, users, ...). Dùng cho @RequestMapping của
     * controller. Để rỗng vì server.servlet.context-path=/api đã có sẵn.
     */
    public static final String BASE = "";

    /** Base path cho xác thực (login). */
    public static final String AUTH = "/auth";
    public static final String AUTH_LOGIN = AUTH + "/login";

    // ---------- Segment paths (dùng trong @GetMapping, @PostMapping, ... khi
    // controller đã @RequestMapping(BASE)) ----------
    public static final String SEG_DEVICES = "/devices";
    public static final String SEG_DEVICES_CONNECT = "/devices/connect";
    public static final String SEG_DEVICE_ID = "/{id}";
    public static final String SEG_DEVICE_DELETE = "/devices/{id}/delete";
    public static final String SEG_DEVICE_ID_PARAM = "/{deviceId}";
    public static final String SEG_DEVICES_CONTROLS = "/devices/controls";
    public static final String SEG_DEVICE_CONTROLS = "/devices/{deviceId}/controls";
    public static final String SEG_DEVICE_CONTROLS_PENDING = SEG_DEVICE_CONTROLS + "/pending";
    public static final String SEG_CONTROLS_STATUS = "/devices/controls/{controlId}/status";
    public static final String SEG_DEVICE_IRRIGATION = "/devices/{deviceId}/irrigation";
    public static final String SEG_DEVICE_IRRIGATION_CONFIG = SEG_DEVICE_IRRIGATION + "/config";
    public static final String SEG_DEVICE_IRRIGATION_HISTORY = SEG_DEVICE_IRRIGATION + "/history";
    public static final String SEG_DEVICE_IRRIGATION_HISTORY_RANGE = SEG_DEVICE_IRRIGATION_HISTORY + "/range";
    public static final String SEG_DEVICE_IRRIGATION_DURATION = SEG_DEVICE_IRRIGATION + "/duration";
    public static final String SEG_DEVICE_SCHEDULES = "/devices/{deviceId}/schedules";
    public static final String SEG_SCHEDULES = "/schedules";
    public static final String SEG_SCHEDULE_ID = "/{id}";
    public static final String SEG_SCHEDULE_ACTIVE = SEG_SCHEDULE_ID + "/active";
    public static final String SEG_DEVICE_SENSOR_DATA = "/devices/{deviceId}/sensor-data";
    public static final String SEG_DEVICE_SENSOR_DATA_LATEST = SEG_DEVICE_SENSOR_DATA + "/latest";
    public static final String SEG_DEVICE_SENSOR_DATA_RANGE = SEG_DEVICE_SENSOR_DATA + "/range";
    public static final String SEG_DEVICE_WATER_BALANCE_STATE = "/devices/{deviceId}/water-balance-state";

    // ---------- AI Service ----------
    public static final String SEG_AI = "/ai";
    public static final String SEG_AI_PREDICT = SEG_AI + "/predict";
    public static final String SEG_AI_TRAIN = SEG_AI + "/train";
    public static final String SEG_AI_RESULTS = SEG_AI + "/results/{deviceId}";
    public static final String SEG_USERS = "/users";
    public static final String SEG_USERS_REGISTER = "/users/register";
    public static final String SEG_USERS_ME = "/users/me";
    public static final String SEG_USERS_ME_CHANGE_PASSWORD = "/users/me/change-password";
    public static final String SEG_USER_ID = "/{id}";
    public static final String SEG_ADMIN = "/admin";
    public static final String SEG_ADMIN_DEVICES = "/admin/devices";
    public static final String SEG_ADMIN_DEVICE_ID = "/admin/devices/{id}";
    public static final String SEG_ADMIN_DEVICE_IRRIGATION_CONFIG = "/admin/devices/{deviceId}/irrigation/config";
    public static final String SEG_ADMIN_USERS = "/admin/users";
    public static final String SEG_ADMIN_USER_ID = "/admin/users/{id}";
    public static final String SEG_ADMIN_CROP_LIBRARIES = "/admin/crop-libraries";
    public static final String SEG_ADMIN_CROP_LIBRARY_ID = "/admin/crop-libraries/{id}";
    public static final String SEG_ADMIN_SOIL_LIBRARIES = "/admin/soil-libraries";
    public static final String SEG_ADMIN_SOIL_LIBRARY_ID = "/admin/soil-libraries/{id}";

    // ---------- Full paths (tham chiếu, OpenAPI, Security khi dùng full URI)
    // ----------
    public static final String DEVICES = BASE + "/devices";
    public static final String DEVICE_ID = "/{id}";
    public static final String DEVICE_ID_PATH = DEVICES + DEVICE_ID;

    /** Lệnh điều khiển: POST gửi lệnh. */
    public static final String DEVICES_CONTROLS = BASE + "/devices/controls";
    /** Lịch sử lệnh theo device, phân trang. */
    public static final String DEVICE_CONTROLS = BASE + "/devices/{deviceId}/controls";
    public static final String DEVICE_CONTROLS_PENDING = DEVICE_CONTROLS + "/pending";
    /** Cập nhật trạng thái lệnh. */
    public static final String CONTROLS_STATUS = BASE + "/devices/controls/{controlId}/status";

    // ---------- Irrigation ----------
    public static final String DEVICE_IRRIGATION = BASE + "/devices/{deviceId}/irrigation";
    public static final String DEVICE_IRRIGATION_CONFIG = DEVICE_IRRIGATION + "/config";
    public static final String DEVICE_IRRIGATION_HISTORY = DEVICE_IRRIGATION + "/history";
    public static final String DEVICE_IRRIGATION_HISTORY_RANGE = DEVICE_IRRIGATION_HISTORY + "/range";
    public static final String DEVICE_IRRIGATION_DURATION = DEVICE_IRRIGATION + "/duration";

    // ---------- Schedules ----------
    public static final String DEVICE_SCHEDULES = BASE + "/devices/{deviceId}/schedules";
    public static final String SCHEDULES = BASE + "/schedules";
    public static final String SCHEDULE_ID = "/{id}";
    public static final String SCHEDULE_ID_PATH = SCHEDULES + SCHEDULE_ID;
    public static final String SCHEDULE_ACTIVE = SCHEDULE_ID_PATH + "/active";

    // ---------- Sensor data ----------
    public static final String DEVICE_SENSOR_DATA = BASE + "/devices/{deviceId}/sensor-data";
    public static final String DEVICE_SENSOR_DATA_LATEST = DEVICE_SENSOR_DATA + "/latest";
    public static final String DEVICE_SENSOR_DATA_RANGE = DEVICE_SENSOR_DATA + "/range";

    // ---------- AI Service ----------
    public static final String AI = BASE + "/ai";
    public static final String AI_PREDICT = AI + "/predict";
    public static final String AI_TRAIN = AI + "/train";
    public static final String AI_RESULTS = AI + "/results/{deviceId}";

    // ---------- Users ----------
    public static final String USERS = BASE + "/users";
    public static final String USERS_REGISTER = USERS + "/register";
    public static final String USERS_ME = USERS + "/me";
    public static final String USERS_ME_CHANGE_PASSWORD = USERS_ME + "/change-password";
    public static final String USER_ID = "/{id}";

    // ---------- Admin ----------
    public static final String ADMIN = BASE + "/admin";
    public static final String ADMIN_DEVICES = ADMIN + "/devices";
    public static final String ADMIN_DEVICE_ID = ADMIN_DEVICES + "/{id}";
    public static final String ADMIN_DEVICE_IRRIGATION_CONFIG = ADMIN + "/devices/{deviceId}/irrigation/config";
    public static final String ADMIN_USERS = ADMIN + "/users";
    public static final String ADMIN_USER_ID = ADMIN_USERS + "/{id}";
    public static final String ADMIN_CROP_LIBRARIES = ADMIN + "/crop-libraries";
    public static final String ADMIN_CROP_LIBRARY_ID = ADMIN_CROP_LIBRARIES + "/{id}";
    public static final String ADMIN_SOIL_LIBRARIES = ADMIN + "/soil-libraries";
    public static final String ADMIN_SOIL_LIBRARY_ID = ADMIN_SOIL_LIBRARIES + "/{id}";

    // ---------- Security ----------
    /** Pattern cho mọi auth (login, ...) – permitAll. */
    public static final String AUTH_ALL = AUTH + "/**";
    /** Đăng ký tài khoản (public) – permitAll. */
    public static final String USERS_REGISTER_PERMIT = BASE + "/users/register";
    /** Pattern mọi API admin – yêu cầu ROLE_ADMIN (RBAC). */
    public static final String ADMIN_ALL = BASE + "/admin/**";
}
