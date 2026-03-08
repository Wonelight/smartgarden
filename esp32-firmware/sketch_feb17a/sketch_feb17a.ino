#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include "Adafruit_SHT4x.h"
#include <BH1750.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <time.h>

// =============================================================
// PIN CONFIG - ESP32-S3
// =============================================================
#define I2C_SDA   8
#define I2C_SCL   9
#define TFT_CS    10
#define TFT_RST   11
#define TFT_DC    12
#define TFT_MOSI  13
#define TFT_SCLK  14
#define SOIL1_PIN 15
#define SOIL2_PIN 16
#define RAIN_PIN  17
#define RELAY_PIN       4
#define LIGHT_RELAY_PIN 39
#define BUTTON_PIN      42
#define BOOT_BUTTON_PIN 0      // Nút BOOT trên board ESP32-S3 (GPIO 0)

// =============================================================
// RELAY LOGIC (Active LOW cho hầu hết module relay)
// =============================================================
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// =============================================================
// CALIBRATION - Resistive sensor: kho=ADC cao, uot=ADC thap
// =============================================================
const int SOIL1_DRY = 4095;
const int SOIL1_WET = 2200;
const int SOIL2_DRY = 4095;
const int SOIL2_WET = 2200;
const int RAIN_DRY  = 4095;
const int RAIN_WET  = 900;

#define PUMP_ON_THRESHOLD  20
#define PUMP_OFF_THRESHOLD 30
#define ADC_SAMPLES        31

// =============================================================
// BUTTON CONFIG
// =============================================================
#define DEBOUNCE_MS            50     // Debounce window
#define SINGLE_CLICK_MAX_MS    300    // Max press duration for single click
#define DOUBLE_CLICK_GAP_MS    400    // Max gap giữa 2 lần nhấn để tính double click
#define LONG_PRESS_MS          3000   // Long press 3s để factory reset
#define CLICK_TIMEOUT_MS       500    // Timeout để xác nhận single click

// =============================================================
// TASK CONFIG
// =============================================================
#define SENSOR_TASK_STACK_SIZE    8192
#define PUMP_TASK_STACK_SIZE      6144
#define DISPLAY_TASK_STACK_SIZE   8192
#define SERIAL_TASK_STACK_SIZE    6144
#define MQTT_TASK_STACK_SIZE      8192
#define BUTTON_TASK_STACK_SIZE    4096
#define BOOT_BTN_TASK_STACK_SIZE  4096

#define SENSOR_TASK_PRIORITY      2
#define PUMP_TASK_PRIORITY        1
#define DISPLAY_TASK_PRIORITY     1
#define SERIAL_TASK_PRIORITY      1
#define MQTT_TASK_PRIORITY        2
#define BUTTON_TASK_PRIORITY      3   // Cao nhất - phản hồi nhanh
#define BOOT_BTN_TASK_PRIORITY    3   // Cao - phản hồi nhanh

// =============================================================
// MQTT CONFIG
// =============================================================
#define MQTT_SENSOR_INTERVAL_MS    10000   // Publish sensor mỗi 10s
#define MQTT_HEARTBEAT_INTERVAL_MS 60000   // Heartbeat mỗi 60s
#define MQTT_RECONNECT_INTERVAL_MS 5000    // Retry connect mỗi 5s
#define MQTT_LOOP_INTERVAL_MS      100     // client.loop() mỗi 100ms
#define MQTT_KEEPALIVE             60      // keepAlive 60s
#define MQTT_BUFFER_SIZE           512     // Buffer size cho PubSubClient

#define DEFAULT_MQTT_SERVER "192.168.0.198"
#define DEFAULT_MQTT_PORT   "1883"

// NTP
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC 25200   // UTC+7 (Vietnam)
#define DAYLIGHT_OFFSET_SEC 0

// =============================================================
// SHARED DATA STRUCTURES
// =============================================================
typedef struct {
  float temperature;
  float humidity;
  float lux;
  int soil1_raw;
  int soil2_raw;
  int rain_raw;
  int soil1_percent;
  int soil2_percent;
  int rain_percent;
  bool pump_state;
  bool light_state;
  unsigned long timestamp;
} SensorData;

// =============================================================
// DEV MODE (giả lập cảm biến khi chưa cắm đất thực tế)
// =============================================================
typedef struct {
  bool     active;      // bật/tắt dev mode
  bool     autoRand;    // tự động random theo thời gian
  float    temp;        // nhiệt độ giả lập (°C)
  float    hum;         // độ ẩm không khí giả lập (%)
  float    lux;         // ánh sáng giả lập (lux)
  int      soil1;       // độ ẩm đất 1 (0-100%)
  int      soil2;       // độ ẩm đất 2 (0-100%)
  int      rain;        // mưa (0-100 %)
} DevMode;

volatile DevMode devMode = {false, false, 28.0f, 65.0f, 500.0f, 30, 30, 0};
SemaphoreHandle_t devModeMutex = NULL;  // bảo vệ devMode

// =============================================================
// DISPLAY DATA (truyền qua displayQueue tới displayTask)
// =============================================================
typedef struct {
  float temp;
  float hum;
  float lux;
  int soil1;
  int soil2;
  int rain;
  bool pump;
  bool lightOn;        // trạng thái rơ-le đèn
  bool aiActive;       // đang chạy tưới AI
  unsigned long aiStartMs;  // millis() khi bắt đầu tưới AI
  int  aiDurSec;       // tổng thời gian tưới AI (giây)
  char modeStr[16];    // chế độ: "AI_PREDICT" / "FUZZY" / "MANUAL" / ""
  int  lastStrategyId; // chiến lược fuzzy lần cuối (0-3)
  char lastTimeStr[6]; // "HH:MM" lần tưới cuối, hoặc ""
} DisplayData;

SensorData sharedData = {0};
SemaphoreHandle_t dataMutex = NULL;
SemaphoreHandle_t tftMutex  = NULL;
QueueHandle_t displayQueue  = NULL;

// =============================================================
// MQTT STATE (protected by mqttStateMutex)
// =============================================================
typedef struct {
  bool manualMode;
  int  setPoint;
  bool pendingStatusPublish;

  unsigned long long currentPumpStartTime;
  float currentPumpSoilBefore;
  char currentPumpMode[20];

  bool aiIrrigationActive;
  unsigned long aiIrrigationStartMs;
  int aiIrrigationDurationSec;

  bool pendingHistoryPublish;
  unsigned long long historyStartTime;
  unsigned long long historyEndTime;
  int historyDuration;
  // historyWaterVolume đã xóa — cloud tự tính từ startTime/endTime + flow rate
  float historySoilBefore;
  float historySoilAfter;
  char historyMode[20];
  char lastIrrigTimeStr[6];  // "HH:MM" vào lần tưới cuối, hoặc "" nếu chưa tưới
  int  lastStrategyId;       // chiến lược fuzzy lần cuối (0-3)
} MqttState;


MqttState mqttState = {false, PUMP_OFF_THRESHOLD, false, 0, 0.0f, "", false, 0, 0, false, 0, 0, 0, 0.0f, 0.0f, "", "", 0};

// Web App registration status
volatile bool webAppRegistered = false;  // True khi device được đăng ký trên web app
volatile bool pairingMode = false;       // True khi đang chờ pairing với account mới

// =============================================================
// FUZZY LOGIC CONFIGURATION
// =============================================================

// Số lượng tập mờ cho mỗi đầu vào
#define NUM_SOIL_SETS   3
#define NUM_RAIN_SETS   3
#define NUM_TEMP_SETS   3
#define NUM_HUM_SETS    3
#define NUM_LIGHT_SETS  3
#define NUM_RULES       (NUM_SOIL_SETS * NUM_RAIN_SETS * NUM_TEMP_SETS * NUM_HUM_SETS * NUM_LIGHT_SETS)  // 243

// Chỉ số các tập mờ
enum SoilSet   { SOIL_DRY, SOIL_MOIST, SOIL_WET };
enum RainSet   { RAIN_NONE, RAIN_LIGHT, RAIN_HEAVY };
enum TempSet   { TEMP_COOL, TEMP_WARM, TEMP_HOT };
enum HumSet    { HUM_LOW, HUM_MEDIUM, HUM_HIGH };
enum LightSet  { LIGHT_DARK, LIGHT_DIM, LIGHT_BRIGHT };
// Chiến lược tưới — fuzzy quyết định CÁCH tưới, không phải bao lâu
enum IrrigationStrategy { STRAT_SKIP, STRAT_GENTLE, STRAT_NORMAL, STRAT_AGGRESSIVE };

// Thông số pulse cho mỗi strategy: {pulseOnSec, pulseOffSec, fallbackDurationSec}
// - pulseOnSec:  bật bơm mỗi chu kỳ (giây)
// - pulseOffSec: nghỉ (soak) giữa các chu kỳ (giây), 0 = tưới liên tục
// - fallbackDurationSec: tổng thời gian tưới khi offline (không có AI duration)
struct StrategyParams {
  int pulseOnSec;
  int pulseOffSec;
  int fallbackDurationSec;
};

static const StrategyParams strategyTable[4] = {
  {0,   0,   0},    // SKIP: không tưới
  {30,  60,  120},  // GENTLE: bật 30s nghỉ 60s, fallback 2 phút
  {60,  45,  240},  // NORMAL: bật 60s nghỉ 45s, fallback 4 phút
  {0,   0,   300},  // AGGRESSIVE: tưới liên tục, fallback 5 phút
};

// Hàm liên thuộc dạng hình thang: mỗi tập mờ là 4 điểm (a,b,c,d)
static const float soilMembership[NUM_SOIL_SETS][4] = {
  {0, 0, 20, 40},     // DRY
  {20, 40, 60, 80},   // MOIST
  {60, 80, 100, 100}  // WET
};
static const float rainMembership[NUM_RAIN_SETS][4] = {
  {0, 0, 10, 30},     // NONE
  {10, 30, 50, 70},   // LIGHT
  {50, 70, 100, 100}  // HEAVY
};
static const float tempMembership[NUM_TEMP_SETS][4] = {
  {0, 0, 15, 25},     // COOL
  {15, 25, 35, 45},   // WARM
  {35, 45, 50, 50}    // HOT (giới hạn trên 50°C)
};
static const float humMembership[NUM_HUM_SETS][4] = {
  {0, 0, 30, 50},     // LOW
  {30, 50, 70, 90},   // MEDIUM
  {70, 90, 100, 100}  // HIGH
};
static const float lightMembership[NUM_LIGHT_SETS][4] = {
  {0, 0, 5, 20},      // DARK
  {5, 20, 50, 80},    // DIM
  {50, 80, 100, 100}  // BRIGHT
};

// Bảng luật: mảng 243 phần tử, mỗi phần tử là OutputSet (0..3)
static uint8_t ruleBase[NUM_RULES];

// Fuzzy pump state machine states
enum FuzzyPumpState { FP_IDLE, FP_PULSE_ON, FP_PULSE_OFF, FP_COOLDOWN };

// =============================================================
// BUTTON STATE MACHINE (ISR + Task)
// =============================================================
typedef enum {
  BTN_IDLE,
  BTN_PRESSED,
  BTN_RELEASED_ONCE,
  BTN_PRESSED_SECOND
} ButtonState;

volatile bool          btnISRFlag    = false;   // ISR -> Task notification
volatile unsigned long btnISRTime    = 0;       // Thời điểm ISR xảy ra
TaskHandle_t           btnTaskHandle = NULL;
SemaphoreHandle_t mqttStateMutex = NULL;

// =============================================================
// OBJECTS
// =============================================================
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
Adafruit_SHT4x  sht4;
BH1750          lightMeter;
bool            bh1750Ready = false;   // Flag: BH1750 đã init thành công chưa
Preferences     preferences;

WiFiClient   espClient;
PubSubClient mqttClient(espClient);

// MQTT config (loaded from Preferences / WiFiManager)
char mqtt_server[40] = DEFAULT_MQTT_SERVER;
char mqtt_port[6]    = DEFAULT_MQTT_PORT;
String deviceCode    = "";

// Topic buffers
String topicStatus    = "";
String topicSensor    = "";
String topicHeartbeat = "";
String topicLwt       = "";
String topicCmd       = "";
String topicCmdAck    = "";
String topicHistory   = "";
String topicRegistration = "";

// =============================================================
// GEO LOCATION (IP-based, fallback khi user không nhập toạ độ)
// =============================================================
float geoLatitude  = 0.0;
float geoLongitude = 0.0;
String geoCity     = "";
String geoRegion   = "";
String geoCountry  = "";
bool   geoResolved = false;  // True khi đã lấy được vị trí

// =============================================================
// FORWARD DECLARATIONS (cần vì gọi trước khi định nghĩa)
// =============================================================
IrrigationStrategy computeIrrigationStrategy(float soil, float rain, float temp, float hum, float light);
void loadMqttConfig();

// =============================================================
// UTILITY: get epoch ms
// =============================================================
unsigned long long getEpochMs() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (unsigned long long)tv.tv_sec * 1000ULL + tv.tv_usec / 1000ULL;
}

// =============================================================
// DEVICE CODE from MAC
// =============================================================
String getDeviceCode() {
  String mac = WiFi.macAddress();  // "AA:BB:CC:DD:EE:FF"
  mac.replace(":", "");
  mac.toUpperCase();
  return mac;
}

// =============================================================
// BUILD TOPICS
// =============================================================
void buildTopics() {
  String prefix = "smart_garden/devices/" + deviceCode;
  topicStatus       = prefix + "/status";
  topicSensor       = prefix + "/sensor";
  topicHeartbeat    = prefix + "/heartbeat";
  topicLwt          = prefix + "/lwt";
  topicCmd          = prefix + "/cmd";
  topicCmdAck       = prefix + "/cmd/ack";
  topicHistory      = prefix + "/history";
  topicRegistration = prefix + "/registration";
}

// =============================================================
// MEDIAN FILTER
// =============================================================
int compareInt(const void* a, const void* b) {
  return (*(int*)a - *(int*)b);
}

int readADC(int pin) {
  int s[ADC_SAMPLES];
  for (int i = 0; i < ADC_SAMPLES; i++) {
    s[i] = analogRead(pin);
    delay(2);
  }
  qsort(s, ADC_SAMPLES, sizeof(int), compareInt);
  return s[ADC_SAMPLES / 2];
}

int toPercent(int raw, int dry, int wet) {
  return constrain(map(raw, dry, wet, 0, 100), 0, 100);
}

// =============================================================
// UI FUNCTIONS
// =============================================================
uint16_t soilColor(int val) {
  if (val < 20)      return ST77XX_RED;
  else if (val < 60) return ST77XX_GREEN;
  else               return ST77XX_BLUE;
}

void drawStaticUI() {
  if (xSemaphoreTake(tftMutex, portMAX_DELAY) == pdTRUE) {
    tft.fillScreen(ST77XX_BLACK);

    // --- Header bar ---
    tft.fillRect(0, 0, 160, 18, ST77XX_BLUE);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.setCursor(5, 5);
    tft.print("GARDEN MONITOR");

    // Connection status labels + initial red dots (same positions as before)
    tft.setTextColor(0xBDF7);
    tft.setCursor(105, 1);  tft.print("W");
    tft.setCursor(105, 10); tft.print("M");
    tft.setCursor(138, 5);  tft.print("S");

    tft.fillCircle(118, 4, 3, ST77XX_RED);
    tft.fillRect(115, 10, 7, 7, ST77XX_RED);
    tft.fillTriangle(148, 2, 144, 9, 152, 9, ST77XX_RED);

    // --- Row 1: T / H / R(ain) labels ---
    tft.setTextColor(ST77XX_YELLOW);
    tft.setCursor(5,   20); tft.print("T:");   // value from x=17
    tft.setCursor(64,  20); tft.print("H:");   // value from x=76
    tft.setCursor(118, 20); tft.print("R:");   // Rain value from x=130

    // --- Row 2: S1 / S2 labels ---
    tft.setCursor(5,  30); tft.print("S1:");
    tft.setCursor(83, 30); tft.print("S2:");

    // --- Divider 1 ---
    tft.drawFastHLine(0, 44, 160, ST77XX_MAGENTA);

    // --- Row 3: Mode / Dur labels ---
    tft.setCursor(5,  46); tft.print("Mode:");
    tft.setCursor(88, 46); tft.print("Dur:");

    // --- Row 4: Strategy / Last irrigate time labels ---
    tft.setCursor(5,  57); tft.print("Strat:");
    tft.setCursor(94, 57); tft.print("Last:");

    // --- Divider 2 ---
    tft.drawFastHLine(0, 68, 160, ST77XX_MAGENTA);

    // --- Row 5: PUMP label ---
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 70); tft.print("PUMP:");

    // --- Divider 3 ---
    tft.drawFastHLine(0, 104, 160, ST77XX_MAGENTA);

    // --- Row 7: Lux / Light relay labels ---
    tft.setTextColor(ST77XX_YELLOW);
    tft.setCursor(5,  106); tft.print("Lux:");
    tft.setCursor(82, 106); tft.print("Light:");

    xSemaphoreGive(tftMutex);
  }
}

// Cập nhật 3 dot trạng thái kết nối trên header
void updateConnectionDots(bool wifiOk, bool mqttOk, bool webAppOk) {
  if (xSemaphoreTake(tftMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    // WiFi: filled circle ● (r=3)
    uint16_t wifiColor = wifiOk ? ST77XX_GREEN : ST77XX_RED;
    tft.fillCircle(118, 4, 3, wifiColor);

    // MQTT: filled square ■ (7x7)
    uint16_t mqttColor = mqttOk ? ST77XX_GREEN : ST77XX_RED;
    tft.fillRect(115, 10, 7, 7, mqttColor);

    // Web App: triangle ▲
    uint16_t webColor = webAppOk ? ST77XX_GREEN : ST77XX_RED;
    tft.fillTriangle(148, 2, 144, 9, 152, 9, webColor);

    xSemaphoreGive(tftMutex);
  }
}

void fillAndPrint(int x, int y, int w, int h, uint16_t color, const char* str) {
  if (xSemaphoreTake(tftMutex, portMAX_DELAY) == pdTRUE) {
    tft.fillRect(x, y, w, h, ST77XX_BLACK);
    tft.setTextColor(color);
    tft.setCursor(x, y);
    tft.print(str);
    xSemaphoreGive(tftMutex);
  }
}

void updateScreen(const DisplayData &d) {
  if (xSemaphoreTake(tftMutex, pdMS_TO_TICKS(500)) != pdTRUE) return;
  char buf[24];
  tft.setTextSize(1);

  // ---- Row 1: Temperature / Humidity / Rain ----
  snprintf(buf, sizeof(buf), "%.1fC ", d.temp);
  tft.fillRect(17, 20, 40, 8, ST77XX_BLACK);
  tft.setTextColor(ST77XX_ORANGE);
  tft.setCursor(17, 20); tft.print(buf);

  snprintf(buf, sizeof(buf), "%.0f%%  ", d.hum);
  tft.fillRect(76, 20, 36, 8, ST77XX_BLACK);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(76, 20); tft.print(buf);

  tft.fillRect(130, 20, 24, 8, ST77XX_BLACK);
  tft.setTextColor(d.rain > 30 ? ST77XX_RED : ST77XX_GREEN);
  tft.setCursor(130, 20);
  tft.print(d.rain > 30 ? "YES" : "NO ");

  // ---- Row 2: Soil 1 / Soil 2 + narrow bars ----
  snprintf(buf, sizeof(buf), "%3d%%", d.soil1);
  tft.fillRect(23, 30, 18, 8, ST77XX_BLACK);
  tft.setTextColor(soilColor(d.soil1));
  tft.setCursor(23, 30); tft.print(buf);
  int s1fill = 33 * d.soil1 / 100;
  tft.fillRect(43,          30, s1fill,      7, soilColor(d.soil1));
  tft.fillRect(43 + s1fill, 30, 33 - s1fill, 7, ST77XX_BLACK);
  tft.drawRect(43, 30, 33, 7, ST77XX_WHITE);

  snprintf(buf, sizeof(buf), "%3d%%", d.soil2);
  tft.fillRect(101, 30, 18, 8, ST77XX_BLACK);
  tft.setTextColor(soilColor(d.soil2));
  tft.setCursor(101, 30); tft.print(buf);
  int s2fill = 35 * d.soil2 / 100;
  tft.fillRect(121,          30, s2fill,      7, soilColor(d.soil2));
  tft.fillRect(121 + s2fill, 30, 35 - s2fill, 7, ST77XX_BLACK);
  tft.drawRect(121, 30, 35, 7, ST77XX_WHITE);

  // ---- Row 3: Mode + AI predicted duration ----
  char modeDisp[10];
  if (d.modeStr[0] == '\0') {
    strncpy(modeDisp, "STANDBY ", sizeof(modeDisp));
  } else {
    snprintf(modeDisp, sizeof(modeDisp), "%-8.8s", d.modeStr);
  }
  tft.fillRect(35, 46, 50, 8, ST77XX_BLACK);
  tft.setTextColor(d.aiActive ? ST77XX_CYAN : ST77XX_WHITE);
  tft.setCursor(35, 46); tft.print(modeDisp);

  tft.fillRect(112, 46, 42, 8, ST77XX_BLACK);
  if (d.aiDurSec > 0) {
    snprintf(buf, sizeof(buf), "%ds   ", d.aiDurSec);
  } else {
    strncpy(buf, "---s ", sizeof(buf));
  }
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(112, 46); tft.print(buf);

  // ---- Row 4: Fuzzy strategy + Last irrigate time ----
  static const char* stratNames[4]  = {"SKIP    ", "GENTLE  ", "NORMAL  ", "AGGR    "};
  static const uint16_t stratColors[4] = {ST77XX_RED, ST77XX_CYAN, ST77XX_GREEN, ST77XX_MAGENTA};
  int si = constrain(d.lastStrategyId, 0, 3);
  tft.fillRect(41, 57, 50, 8, ST77XX_BLACK);
  tft.setTextColor(stratColors[si]);
  tft.setCursor(41, 57); tft.print(stratNames[si]);

  const char* tstr = (d.lastTimeStr[0] == '\0') ? "--:--" : d.lastTimeStr;
  tft.fillRect(124, 57, 30, 8, ST77XX_BLACK);
  tft.setTextColor(d.lastTimeStr[0] != '\0' ? ST77XX_CYAN : 0x8410 /* dark grey */);
  tft.setCursor(124, 57); tft.print(tstr);

  // ---- Row 5: Pump status (y=70) ----
  const char* pumpLabel;
  uint16_t    pumpColor;
  if (d.pump) {
    if (strncmp(d.modeStr, "AI_PREDICT", 7) == 0) {
      pumpLabel = "> AI RUNNING <";
      pumpColor = ST77XX_CYAN;
    } else if (strncmp(d.modeStr, "MANUAL", 6) == 0) {
      pumpLabel = ">>> MANUAL  <<<";
      pumpColor = ST77XX_YELLOW;
    } else {
      pumpLabel = ">>> RUNNING <<<";
      pumpColor = ST77XX_RED;
    }
  } else {
    pumpLabel = "   STANDBY    ";
    pumpColor = ST77XX_GREEN;
  }
  tft.fillRect(35, 70, 120, 10, ST77XX_BLACK);
  tft.setTextColor(pumpColor);
  tft.setCursor(35, 70); tft.print(pumpLabel);

  // ---- Row 6: Progress bar + time remaining (y=82..103) ----
  if (d.aiActive && d.aiDurSec > 0) {
    unsigned long elapsed = millis() - d.aiStartMs;
    unsigned long total   = (unsigned long)d.aiDurSec * 1000UL;
    int pct    = (int)min(100UL, elapsed * 100UL / total);
    int fillW  = 150 * pct / 100;
    tft.fillRect(5,           82, fillW,        10, ST77XX_GREEN);
    tft.fillRect(5 + fillW,   82, 150 - fillW,  10, 0x2104 /* dark grey */);
    tft.drawRect(5, 82, 150, 10, ST77XX_WHITE);

    int remainSec = (int)((total - min(elapsed, total)) / 1000UL);
    snprintf(buf, sizeof(buf), "%02d:%02d / %02d:%02d",
             remainSec / 60, remainSec % 60,
             d.aiDurSec / 60, d.aiDurSec % 60);
    tft.fillRect(0, 94, 160, 10, ST77XX_BLACK);
    tft.setTextColor(ST77XX_WHITE);
    int cx = (160 - (int)strlen(buf) * 6) / 2;
    tft.setCursor(cx, 94); tft.print(buf);
  } else {
    tft.fillRect(0, 82, 160, 22, ST77XX_BLACK);
  }

  // ---- Row 7: Lux + Light relay (y=106) ----
  if (d.lux > 9999) snprintf(buf, sizeof(buf), ">9999lx ");
  else              snprintf(buf, sizeof(buf), "%dlx    ", (int)d.lux);
  tft.fillRect(29, 106, 52, 8, ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(29, 106); tft.print(buf);

  tft.fillRect(118, 106, 24, 8, ST77XX_BLACK);
  tft.setTextColor(d.lightOn ? ST77XX_YELLOW : 0x8410 /* dim grey */);
  tft.setCursor(118, 106); tft.print(d.lightOn ? "ON " : "OFF");

  xSemaphoreGive(tftMutex);
}

// =============================================================
// MQTT: PUBLISH HELPERS
// =============================================================
void publishSensorData() {
  SensorData localData;
  memset(&localData, 0, sizeof(SensorData));

  if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    memcpy(&localData, &sharedData, sizeof(SensorData));
    xSemaphoreGive(dataMutex);
  }

  if (localData.timestamp == 0) return;  // Chưa có data

  JsonDocument doc;
  doc["soilMoisture"]    = (float)localData.soil1_percent;
  doc["soilMoisture2"]   = (float)localData.soil2_percent;
  doc["temperature"]     = localData.temperature;
  doc["humidity"]        = localData.humidity;
  doc["lightIntensity"]  = localData.lux;
  doc["rainDetected"]    = (localData.rain_percent > 30);
  doc["rainIntensity"]   = localData.rain_percent;
  doc["ambientLight"]    = localData.lux;
  doc["pumpState"]       = localData.pump_state;
  doc["lightState"]      = localData.light_state;
  doc["ts"]              = (long long)getEpochMs();

  char buffer[MQTT_BUFFER_SIZE];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  if (mqttClient.publish(topicSensor.c_str(), buffer)) {
    Serial.printf("[MQTT] Sensor published (%d bytes)\n", len);
  } else {
    Serial.println("[MQTT] Sensor publish FAILED");
  }
}

void publishHeartbeat() {
  JsonDocument doc;
  doc["ts"] = (long long)getEpochMs();

  char buffer[64];
  serializeJson(doc, buffer, sizeof(buffer));

  mqttClient.publish(topicHeartbeat.c_str(), buffer);
  Serial.println("[MQTT] Heartbeat sent");
}

void publishStatus() {
  SensorData localData;
  bool localManualMode = false;
  int  localSetPoint   = PUMP_OFF_THRESHOLD;

  if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    memcpy(&localData, &sharedData, sizeof(SensorData));
    xSemaphoreGive(dataMutex);
  }

  if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    localManualMode = mqttState.manualMode;
    localSetPoint   = mqttState.setPoint;
    mqttState.pendingStatusPublish = false;
    xSemaphoreGive(mqttStateMutex);
  }

  JsonDocument doc;
  doc["online"]      = true;
  doc["manualMode"]  = localManualMode;
  doc["pumpState"]   = localData.pump_state;
  doc["lightState"]  = localData.light_state;
  doc["setPoint"]    = localSetPoint;
  doc["ts"]          = (long long)getEpochMs();

  // Include auto-detected location (fallback for backend)
  if (geoResolved) {
    doc["geoLat"]     = geoLatitude;
    doc["geoLng"]     = geoLongitude;
    doc["geoCity"]    = geoCity;
    doc["geoRegion"]  = geoRegion;
    doc["geoCountry"] = geoCountry;
  }

  char buffer[512];
  serializeJson(doc, buffer, sizeof(buffer));

  // Status is retained
  mqttClient.publish(topicStatus.c_str(), buffer, true);
  Serial.println("[MQTT] Status published (retained)");
}

void publishCmdAck(const char* cmdId, const char* status, const char* message) {
  JsonDocument doc;
  
  // Explicitly ensure valid double-quoted Strings are sent to JSON
  doc["cmdId"]   = String(cmdId);
  doc["status"]  = String(status);
  
  if (message != NULL && strlen(message) > 0) {
    doc["message"] = String(message);
  }

  char buffer[256];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));
  buffer[n] = '\0';

  mqttClient.publish(topicCmdAck.c_str(), buffer);
  Serial.printf("[MQTT] ACK sent: %s\n", buffer);
}

void publishHistory() {
  MqttState localHistory;
  if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    if (!mqttState.pendingHistoryPublish) {
      xSemaphoreGive(mqttStateMutex);
      return;
    }
    memcpy(&localHistory, &mqttState, sizeof(MqttState));
    mqttState.pendingHistoryPublish = false;
    xSemaphoreGive(mqttStateMutex);
  }

  JsonDocument doc;
  doc["startTime"]          = (long long)localHistory.historyStartTime;
  doc["endTime"]            = (long long)localHistory.historyEndTime;
  doc["duration"]           = localHistory.historyDuration;
  doc["mode"]               = localHistory.historyMode;
  doc["soilMoistureBefore"] = localHistory.historySoilBefore;
  doc["soilMoistureAfter"]  = localHistory.historySoilAfter;
  doc["deviceCode"]         = deviceCode;

  char buffer[512];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));

  if (mqttClient.publish(topicHistory.c_str(), buffer)) {
    Serial.printf("[MQTT] History published (%d bytes)\n", len);
  } else {
    Serial.println("[MQTT] History publish FAILED");
  }
}

// =============================================================
// MQTT: COMMAND HANDLER (callback)
// =============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Parse payload
  char json[MQTT_BUFFER_SIZE];
  size_t copyLen = min((unsigned int)(MQTT_BUFFER_SIZE - 1), length);
  memcpy(json, payload, copyLen);
  json[copyLen] = '\0';

  String topicStr = String(topic);

  // === Xử lý topic registration ===
  if (topicStr == topicRegistration) {
    Serial.printf("[MQTT] Registration received: %s\n", json);
    
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, json);
    if (error) {
      Serial.printf("[MQTT] Registration parse error: %s\n", error.c_str());
      return;
    }
    
    const char* action = doc["action"] | "";
    
    if (strcmp(action, "DEVICE_REMOVED") == 0) {
      webAppRegistered = false;
      Serial.println("[REG] ⚠️ Device REMOVED from web app!");
    } else if (strcmp(action, "DEVICE_REGISTERED") == 0) {
      webAppRegistered = true;
      // Thoát pairing mode nếu đang pairing
      if (pairingMode) {
        pairingMode = false;
        Serial.println("[REG] ✅ Pairing SUCCESS! Exiting pairing mode");
      } else {
        Serial.println("[REG] ✅ Device REGISTERED on web app");
      }
    }
    return;
  }

  // === Chỉ xử lý topic cmd (bên dưới) ===
  if (topicStr != topicCmd) return;

  Serial.printf("[MQTT] CMD received: %s\n", json);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, json);
  if (error) {
    Serial.printf("[MQTT] CMD parse error: %s\n", error.c_str());
    return;
  }

  const char* cmdId = doc["cmdId"] | "";
  const char* cmd   = doc["cmd"]   | "";

  if (strlen(cmdId) == 0 || strlen(cmd) == 0) {
    Serial.println("[MQTT] CMD missing cmdId or cmd");
    return;
  }

  Serial.printf("[CMD] cmdId=%s cmd=%s\n", cmdId, cmd);

  // Execute command
  bool success = true;
  char ackMsgBuf[64] = "";
  const char* ackMsg = ackMsgBuf;

  if (strcmp(cmd, "PUMP_ON") == 0) {
    // Manual mode: bật bơm
    digitalWrite(RELAY_PIN, RELAY_ON);
    float currentSoil = 0;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.pump_state = true;
      currentSoil = sharedData.soil1_percent;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = true;
      mqttState.aiIrrigationActive = false;  // Cancel AI irrigation nếu đang chạy
      mqttState.pendingStatusPublish = true;
      mqttState.currentPumpStartTime = getEpochMs();
      mqttState.currentPumpSoilBefore = currentSoil;
      strncpy(mqttState.currentPumpMode, "MANUAL", sizeof(mqttState.currentPumpMode) - 1);
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Pump turned ON (manual)";
    Serial.println("[CMD] PUMP_ON executed");

  } else if (strcmp(cmd, "PUMP_OFF") == 0) {
    // Manual mode: tắt bơm
    digitalWrite(RELAY_PIN, RELAY_OFF);
    float currentSoil = 0;
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.pump_state = false;
      currentSoil = sharedData.soil1_percent;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = true;
      mqttState.aiIrrigationActive = false;  // Cancel AI irrigation nếu đang chạy
      mqttState.pendingStatusPublish = true;
      
      unsigned long long endTime = getEpochMs();
      int duration = (endTime > mqttState.currentPumpStartTime) ? (endTime - mqttState.currentPumpStartTime) / 1000 : 0;
      
      mqttState.historyStartTime = mqttState.currentPumpStartTime;
      mqttState.historyEndTime = endTime;
      mqttState.historyDuration = duration;
      mqttState.historySoilBefore = mqttState.currentPumpSoilBefore;
      mqttState.historySoilAfter = currentSoil;
      strncpy(mqttState.historyMode, mqttState.currentPumpMode, sizeof(mqttState.historyMode) - 1);
      mqttState.pendingHistoryPublish = true;

      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Pump turned OFF (manual)";
    Serial.println("[CMD] PUMP_OFF executed");

  } else if (strcmp(cmd, "AUTO") == 0) {
    // Trở lại auto mode
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = false;
      mqttState.aiIrrigationActive = false;  // Reset AI irrigation state
      mqttState.pendingStatusPublish = true;
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Switched to AUTO mode";
    Serial.println("[CMD] AUTO mode activated");

  } else if (strcmp(cmd, "SET_SETPOINT") == 0) {
    int newSetpoint = doc["params"]["setpoint"] | -1;
    if (newSetpoint >= 0 && newSetpoint <= 100) {
      if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
        mqttState.setPoint = newSetpoint;
        mqttState.pendingStatusPublish = true;
        xSemaphoreGive(mqttStateMutex);
      }
      ackMsg = "Setpoint updated";
      Serial.printf("[CMD] SET_SETPOINT = %d\n", newSetpoint);
    } else {
      success = false;
      ackMsg = "Invalid setpoint (0-100)";
    }

  } else if (strcmp(cmd, "IRRIGATE") == 0) {
    // Plan A: AI-driven irrigation with duration (seconds)
    int duration = doc["params"]["duration"] | -1;
    if (duration > 0 && duration <= 600) {  // Max 10 phút/lần — khớp với Spring Boot cap

      // Gate 1 (time check) đã bị loại khỏi ESP32:
      // - AI commands: backend đã chặn ngoài Decision Window rồi
      // - Manual commands: người dùng chủ động gửi, không nên block theo giờ

      // --- Gate 2: Safety-only check cho AI IRRIGATE command ---
      // AI pipeline đã tính FAO + water balance + ML → không dùng fuzzy full veto.
      // Chỉ chặn các trường hợp safety thực sự: đất đã bão hoà hoặc đang mưa nặng.
      float currentSoil = 0, currentTemp = 0, currentHum = 0, currentLux = 0;
      int currentRain = 0;
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
        currentSoil = (sharedData.soil1_percent + sharedData.soil2_percent) / 2.0f;
        currentTemp = sharedData.temperature;
        currentHum  = sharedData.humidity;
        currentLux  = sharedData.lux;
        currentRain = sharedData.rain_percent;
        xSemaphoreGive(dataMutex);
      }

      if (currentSoil >= 85.0f) {
        snprintf(ackMsgBuf, sizeof(ackMsgBuf), "Skipped: soil saturated (%.0f%%)", currentSoil);
        publishCmdAck(cmdId, "skipped", ackMsgBuf);
        Serial.printf("[CMD] IRRIGATE safety SKIP: soil saturated (%.0f%%)\n", currentSoil);
        return;
      }
      if (currentRain > 50) {
        snprintf(ackMsgBuf, sizeof(ackMsgBuf), "Skipped: heavy rain (%d%%)", currentRain);
        publishCmdAck(cmdId, "skipped", ackMsgBuf);
        Serial.printf("[CMD] IRRIGATE safety SKIP: heavy rain (%d%%)\n", currentRain);
        return;
      }

      // Tính strategy để điều chỉnh pulse pattern (không veto)
      float lightScaled = constrain(currentLux / 100.0f, 0.0f, 100.0f);
      IrrigationStrategy strat = computeIrrigationStrategy(
        currentSoil, (float)currentRain, currentTemp, currentHum, lightScaled);
      // Nếu fuzzy ra SKIP nhưng AI đã quyết định tưới → dùng STRAT_NORMAL an toàn
      if (strat == STRAT_SKIP) strat = STRAT_NORMAL;

      // --- Tất cả gate đều qua: bật relay ---
      digitalWrite(RELAY_PIN, RELAY_ON);
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
        sharedData.pump_state = true;
        xSemaphoreGive(dataMutex);
      }

      if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
        mqttState.aiIrrigationActive = true;
        mqttState.aiIrrigationStartMs = millis();
        mqttState.aiIrrigationDurationSec = duration;
        mqttState.currentPumpStartTime = getEpochMs();
        mqttState.currentPumpSoilBefore = currentSoil;
        strncpy(mqttState.currentPumpMode, "AI_PREDICT", sizeof(mqttState.currentPumpMode) - 1);
        mqttState.pendingStatusPublish = true;
        // Lưu thông tin hiển thị: thời điểm tưới + chiến lược fuzzy
        struct tm tirr;
        if (getLocalTime(&tirr)) {
          snprintf(mqttState.lastIrrigTimeStr, sizeof(mqttState.lastIrrigTimeStr),
                   "%02d:%02d", tirr.tm_hour, tirr.tm_min);
        }
        mqttState.lastStrategyId = (int)strat;
        xSemaphoreGive(mqttStateMutex);
      }

      snprintf(ackMsgBuf, sizeof(ackMsgBuf), "AI irrigation started: %ds strategy=%d", duration, (int)strat);
      ackMsg = ackMsgBuf;
      Serial.printf("[CMD] IRRIGATE duration=%ds strategy=%d\n", duration, (int)strat);
    } else {
      success = false;
      ackMsg = "Invalid duration (1-600s)";
    }

  } else if (strcmp(cmd, "LIGHT_ON") == 0) {
    digitalWrite(LIGHT_RELAY_PIN, RELAY_ON);
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.light_state = true;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.pendingStatusPublish = true;
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Light turned ON";
    Serial.println("[CMD] LIGHT_ON executed");

  } else if (strcmp(cmd, "LIGHT_OFF") == 0) {
    digitalWrite(LIGHT_RELAY_PIN, RELAY_OFF);
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.light_state = false;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.pendingStatusPublish = true;
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Light turned OFF";
    Serial.println("[CMD] LIGHT_OFF executed");

  } else {
    success = false;
    ackMsg = "Unknown command";
    Serial.printf("[CMD] Unknown command: %s\n", cmd);
  }

  // Gửi ACK
  publishCmdAck(cmdId, success ? "ok" : "error", ackMsg);
}

// =============================================================
// MQTT: CONNECT / RECONNECT
// =============================================================
bool mqttConnect() {
  if (mqttClient.connected()) return true;

  Serial.printf("[MQTT] Connecting to %s:%s as %s ...\n", 
                mqtt_server, mqtt_port, deviceCode.c_str());

  // LWT config
  const char* lwtPayload = "{\"status\":\"offline\"}";

  bool connected = mqttClient.connect(
    deviceCode.c_str(),   // ClientID
    NULL,                 // username (NULL cho dev)
    NULL,                 // password
    topicLwt.c_str(),     // LWT topic
    1,                    // LWT QoS
    true,                 // LWT retain
    lwtPayload            // LWT payload
  );

  if (connected) {
    Serial.println("[MQTT] Connected!");

    // Subscribe command topic
    mqttClient.subscribe(topicCmd.c_str(), 1);
    Serial.printf("[MQTT] Subscribed: %s\n", topicCmd.c_str());

    // Subscribe registration topic (web app sẽ gửi DEVICE_REMOVED / DEVICE_REGISTERED)
    mqttClient.subscribe(topicRegistration.c_str(), 1);
    Serial.printf("[MQTT] Subscribed: %s\n", topicRegistration.c_str());

    // Publish status online (retained)
    publishStatus();

    return true;
  } else {
    Serial.printf("[MQTT] Connect failed, rc=%d\n", mqttClient.state());
    return false;
  }
}

// =============================================================
// TASKS
// =============================================================
void sensorTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  unsigned long lastBH1750Retry = 0;
  
  while(1) {
    // === Tạm dừng khi đang pairing ===
    if (pairingMode) {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    sensors_event_t hum, tmp;
    
    // --- BH1750 auto-retry mỗi 10s nếu chưa sẵn sàng ---
    if (!bh1750Ready) {
      unsigned long now = millis();
      if (now - lastBH1750Retry > 10000) {
        lastBH1750Retry = now;
        if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
          bh1750Ready = true;
          Serial.println("[BH1750] Re-init SUCCESS");
        } else {
          Serial.println("[BH1750] Re-init FAILED, retry in 10s");
        }
      }
    }

    if (sht4.getEvent(&hum, &tmp)) {
      float lux = 0;
      if (bh1750Ready) {
        lux = lightMeter.readLightLevel();
        if (lux < 0) {
          lux = 0;
          // Sensor có thể bị ngắt kết nối
          bh1750Ready = false;
          Serial.println("[BH1750] Read failed, will retry");
        }
      }
      
      int s1Raw = readADC(SOIL1_PIN);
      int s2Raw = readADC(SOIL2_PIN);
      int rnRaw = readADC(RAIN_PIN);

      int p1 = toPercent(s1Raw, SOIL1_DRY, SOIL1_WET);
      int p2 = toPercent(s2Raw, SOIL2_DRY, SOIL2_WET);
      int rainPct = toPercent(rnRaw, RAIN_DRY, RAIN_WET);

      if (xSemaphoreTake(dataMutex, portMAX_DELAY) == pdTRUE) {
        sharedData.temperature = tmp.temperature;
        sharedData.humidity = hum.relative_humidity;
        sharedData.lux = lux;
        sharedData.soil1_raw = s1Raw;
        sharedData.soil2_raw = s2Raw;
        sharedData.rain_raw = rnRaw;
        sharedData.soil1_percent = p1;
        sharedData.soil2_percent = p2;
        sharedData.rain_percent = rainPct;
        sharedData.timestamp = xTaskGetTickCount();
        
        xSemaphoreGive(dataMutex);
      }

      // === DEV MODE: ghi đè giá trị cảm biến bằng mock data ===
      if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        if (devMode.active) {
          // Auto-random: dao động ngau nhiên ±3 mỗi chu kỳ 2s
          if (devMode.autoRand) {
            devMode.soil1 = constrain(devMode.soil1 + (random(-3, 4)), 0, 100);
            devMode.soil2 = constrain(devMode.soil2 + (random(-3, 4)), 0, 100);
            devMode.temp  = constrain(devMode.temp  + (random(-5, 6)) * 0.1f, 10.0f, 50.0f);
            devMode.hum   = constrain(devMode.hum   + (random(-3, 4)) * 0.5f, 10.0f, 99.0f);
            devMode.lux   = constrain(devMode.lux   + (random(-50, 51)) * 1.0f, 0.0f, 10000.0f);
          }
          // Ghi đè sharedData
          if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            sharedData.temperature  = devMode.temp;
            sharedData.humidity     = devMode.hum;
            sharedData.lux          = devMode.lux;
            sharedData.soil1_percent = devMode.soil1;
            sharedData.soil2_percent = devMode.soil2;
            sharedData.rain_percent  = devMode.rain;
            // cập nhật các local vars để DisplayData được đúng
            p1 = devMode.soil1;
            p2 = devMode.soil2;
            rainPct = devMode.rain;
            lux = devMode.lux;
            xSemaphoreGive(dataMutex);
          }
          // Cập nhật local sensor vars cho DisplayData ở dưới
          tmp.temperature       = devMode.temp;
          hum.relative_humidity = devMode.hum;
        }
        xSemaphoreGive(devModeMutex);
      }

      bool currentPumpState = false;
      bool currentLightState = false;
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        currentPumpState  = sharedData.pump_state;
        currentLightState = sharedData.light_state;
        xSemaphoreGive(dataMutex);
      }

      DisplayData displayData;
      displayData.temp  = tmp.temperature;
      displayData.hum   = hum.relative_humidity;
      displayData.lux   = lux;
      displayData.soil1 = p1;
      displayData.soil2 = p2;
      displayData.rain  = rainPct;
      displayData.pump  = currentPumpState;
      displayData.lightOn = currentLightState;

      // Sao chép trạng thái AI/predict từ mqttState
      if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        displayData.aiActive    = mqttState.aiIrrigationActive;
        displayData.aiStartMs   = mqttState.aiIrrigationStartMs;
        displayData.aiDurSec    = mqttState.aiIrrigationDurationSec;
        strncpy(displayData.modeStr, mqttState.currentPumpMode, sizeof(displayData.modeStr) - 1);
        displayData.modeStr[sizeof(displayData.modeStr) - 1] = '\0';
        displayData.lastStrategyId = mqttState.lastStrategyId;
        strncpy(displayData.lastTimeStr, mqttState.lastIrrigTimeStr, sizeof(displayData.lastTimeStr) - 1);
        displayData.lastTimeStr[sizeof(displayData.lastTimeStr) - 1] = '\0';
        xSemaphoreGive(mqttStateMutex);
      } else {
        displayData.aiActive      = false;
        displayData.aiStartMs     = 0;
        displayData.aiDurSec      = 0;
        displayData.modeStr[0]    = '\0';
        displayData.lastStrategyId = 0;
        displayData.lastTimeStr[0] = '\0';
      }
      
      xQueueOverwrite(displayQueue, &displayData);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(2000));
  }
}

// =============================================================
// FUZZY LOGIC FUNCTIONS
// =============================================================

// Hàm tính độ phụ thuộc hình thang
float membershipTrap(float x, const float params[4]) {
  float a = params[0], b = params[1], c = params[2], d = params[3];
  if (x <= a || x >= d) return 0.0;
  if (x >= b && x <= c) return 1.0;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > c && x < d) return (d - x) / (d - c);
  return 0.0;
}

// Xây dựng bộ 243 luật dựa trên heuristic — output là IrrigationStrategy
void initRuleBase() {
  int idx = 0;
  for (int s = 0; s < NUM_SOIL_SETS; s++) {
    for (int r = 0; r < NUM_RAIN_SETS; r++) {
      for (int t = 0; t < NUM_TEMP_SETS; t++) {
        for (int h = 0; h < NUM_HUM_SETS; h++) {
          for (int l = 0; l < NUM_LIGHT_SETS; l++) {
            int base = 0;

            // Heuristic chính: soil + rain → quyết định chiến lược tưới
            if (s == SOIL_DRY) {
              if (r == RAIN_NONE) base = STRAT_AGGRESSIVE;   // Đất khô, không mưa → tưới hết sức
              else if (r == RAIN_LIGHT) base = STRAT_NORMAL;  // Đất khô, mưa nhẹ → tưới vừa
              else base = STRAT_SKIP;                          // Đất khô nhưng mưa nặng → bỏ qua
            } else if (s == SOIL_MOIST) {
              if (r == RAIN_NONE) base = STRAT_GENTLE;         // Đất ẩm, không mưa → tưới nhẹ pulse
              else base = STRAT_SKIP;                          // Đất ẩm + mưa → bỏ qua
            } else { // SOIL_WET
              base = STRAT_SKIP;                               // Đất ướt → không tưới
            }

            // Điều chỉnh theo nhiệt độ + độ ẩm không khí
            if (t == TEMP_HOT && h == HUM_LOW) base = min(base + 1, (int)STRAT_AGGRESSIVE);
            if (t == TEMP_COOL && h == HUM_HIGH) base = max(base - 1, (int)STRAT_SKIP);

            // Điều chỉnh theo ánh sáng (bay hơi nhanh hơn)
            if (l == LIGHT_BRIGHT) base = min(base + 1, (int)STRAT_AGGRESSIVE);
            if (l == LIGHT_DARK) base = max(base - 1, (int)STRAT_SKIP);

            ruleBase[idx++] = (uint8_t)base;
          }
        }
      }
    }
  }
  Serial.printf("[FUZZY] Rule base initialized: %d rules (strategy output)\n", idx);
}

// Suy luận mờ: xác định chiến lược tưới dựa trên 5 đầu vào
// Trả về IrrigationStrategy (SKIP / GENTLE / NORMAL / AGGRESSIVE)
IrrigationStrategy computeIrrigationStrategy(float soil, float rain, float temp, float hum, float light) {
  // Giới hạn đầu vào trong khoảng hợp lệ
  soil  = constrain(soil, 0, 100);
  rain  = constrain(rain, 0, 100);
  temp  = constrain(temp, 0, 50);
  hum   = constrain(hum, 0, 100);
  light = constrain(light, 0, 100);

  // Tổng trọng số cho mỗi strategy
  float stratWeights[4] = {0, 0, 0, 0};

  int idx = 0;
  for (int s = 0; s < NUM_SOIL_SETS; s++) {
    float muSoil = membershipTrap(soil, soilMembership[s]);
    if (muSoil == 0.0) { idx += NUM_RAIN_SETS * NUM_TEMP_SETS * NUM_HUM_SETS * NUM_LIGHT_SETS; continue; }

    for (int r = 0; r < NUM_RAIN_SETS; r++) {
      float muRain = membershipTrap(rain, rainMembership[r]);
      if (muRain == 0.0) { idx += NUM_TEMP_SETS * NUM_HUM_SETS * NUM_LIGHT_SETS; continue; }

      for (int t = 0; t < NUM_TEMP_SETS; t++) {
        float muTemp = membershipTrap(temp, tempMembership[t]);
        if (muTemp == 0.0) { idx += NUM_HUM_SETS * NUM_LIGHT_SETS; continue; }

        for (int h = 0; h < NUM_HUM_SETS; h++) {
          float muHum = membershipTrap(hum, humMembership[h]);
          if (muHum == 0.0) { idx += NUM_LIGHT_SETS; continue; }

          for (int l = 0; l < NUM_LIGHT_SETS; l++) {
            float muLight = membershipTrap(light, lightMembership[l]);

            // AND (T-norm min)
            float firing = muSoil;
            firing = min(firing, muRain);
            firing = min(firing, muTemp);
            firing = min(firing, muHum);
            firing = min(firing, muLight);

            if (firing > 0) {
              uint8_t strat = ruleBase[idx];
              stratWeights[strat] += firing;
            }
            idx++;
          }
        }
      }
    }
  }

  // Chọn strategy có tổng trọng số lớn nhất (winner-takes-all)
  IrrigationStrategy best = STRAT_SKIP;
  float bestWeight = stratWeights[0];
  for (int i = 1; i < 4; i++) {
    if (stratWeights[i] > bestWeight) {
      bestWeight = stratWeights[i];
      best = (IrrigationStrategy)i;
    }
  }

  // Throttle: chỉ in khi strategy thay đổi hoặc mỗi 30s (tránh log spam 2s/lần)
  static IrrigationStrategy lastLoggedStrat = (IrrigationStrategy)-1;
  static unsigned long lastFuzzyLogMs = 0;
  unsigned long nowMs = millis();
  if (best != lastLoggedStrat || (nowMs - lastFuzzyLogMs) >= 30000UL) {
    Serial.printf("[FUZZY] Strategy: %s (weights: SKIP=%.2f GENTLE=%.2f NORMAL=%.2f AGGR=%.2f)\n",
      best == STRAT_SKIP ? "SKIP" : best == STRAT_GENTLE ? "GENTLE" : best == STRAT_NORMAL ? "NORMAL" : "AGGRESSIVE",
      stratWeights[0], stratWeights[1], stratWeights[2], stratWeights[3]);
    lastLoggedStrat = best;
    lastFuzzyLogMs  = nowMs;
  }

  return best;
}

// =============================================================
// PUMP TASK
// =============================================================
void pumpTask(void *pvParameters) {
  FuzzyPumpState fuzzyState = FP_IDLE;
  unsigned long fuzzySessionStart = 0;
  unsigned long fuzzyTotalDurationMs = 0;
  unsigned long fuzzyPulseStart = 0;
  int fuzzyPulseOnMs = 0;
  int fuzzyPulseOffMs = 0;
  unsigned long fuzzyTotalWateredMs = 0;
  unsigned long fuzzyCooldownUntil = 0;
  unsigned long fuzzyLastSessionEnd = 0;
  const unsigned long COOLDOWN_PERIOD = 300000UL;       // 5 menit
  const unsigned long MIN_FUZZY_INTERVAL_MS = 600000UL; // 10 menit antara 2 sesi fallback
  bool lastManualMode = false;
  IrrigationStrategy currentStrategy = STRAT_SKIP;
  bool shouldFinishIrrigation = false;

  while(1) {
    // === Tạm dừng khi đang pairing ===
    if (pairingMode) {
      if (digitalRead(RELAY_PIN) == RELAY_ON) {
        digitalWrite(RELAY_PIN, RELAY_OFF);
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          sharedData.pump_state = false;
          xSemaphoreGive(dataMutex);
        }
      }
      fuzzyState = FP_IDLE;
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    // --- Đọc sensor qua mutex, lưu vào biến local ---
    float soil = 0, temp = 0, hum = 0, luxVal = 0;
    int rainPct = 0;
    unsigned long sensorTimestamp = 0;
    unsigned long currentTime = millis();

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      // FIX: dùng trung bình 2 sensor, đọc dưới mutex
      soil  = (sharedData.soil1_percent + sharedData.soil2_percent) / 2.0f;
      temp  = sharedData.temperature;
      hum   = sharedData.humidity;
      luxVal = sharedData.lux;
      rainPct = sharedData.rain_percent;
      sensorTimestamp = sharedData.timestamp;
      xSemaphoreGive(dataMutex);
    }

    if (sensorTimestamp == 0) {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    // FIX: light scale — 10,000 lux = 100 (max thực tế trong nhà/vườn có mái che)
    // Ngoài trời không che: >10,000 lux bị clamp về 100 → luôn BRIGHT, chấp nhận được
    float lightScaled = constrain(luxVal / 100.0f, 0.0f, 100.0f);

    // --- Đọc trạng thái MQTT ---
    bool manualMode = false;
    bool aiActive = false;
    unsigned long aiStartMs = 0;
    int aiDurationSec = 0;

    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      manualMode    = mqttState.manualMode;
      aiActive      = mqttState.aiIrrigationActive;
      aiStartMs     = mqttState.aiIrrigationStartMs;
      aiDurationSec = mqttState.aiIrrigationDurationSec;
      xSemaphoreGive(mqttStateMutex);
    }

    // Phát hiện chuyển manual ↔ auto
    if (manualMode != lastManualMode) {
      if (!manualMode) {
        digitalWrite(RELAY_PIN, RELAY_OFF);
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          sharedData.pump_state = false;
          xSemaphoreGive(dataMutex);
        }
        fuzzyState = FP_IDLE;
        Serial.println("[PUMP] Exiting manual mode, fuzzy reset to IDLE");
      }
      lastManualMode = manualMode;
    }

    shouldFinishIrrigation = false;

    // ================================================================
    if (manualMode) {
      // MANUAL MODE: relay điều khiển trực tiếp từ MQTT command handler
    }

    // ================================================================
    else if (aiActive) {
      // AI IRRIGATION MODE: AI quyết định duration, fuzzy quyết định strategy
      // ================================================================

      if (fuzzyState == FP_IDLE) {
        currentStrategy = computeIrrigationStrategy(soil, (float)rainPct, temp, hum, lightScaled);

        // AI mode: CMD handler đã validate safety (soil < 85%, rain < 50%).
        // Pump task KHÔNG veto AI command — chỉ dùng fuzzy để chọn pulse pattern.
        // Nếu fuzzy cho SKIP (vd: đêm tối lux=0 kéo strategy xuống), fallback NORMAL.
        if (currentStrategy == STRAT_SKIP) {
          currentStrategy = STRAT_NORMAL;
          Serial.println("[PUMP] AI mode: fuzzy SKIP overridden → NORMAL");
        }

        {
          const StrategyParams &sp = strategyTable[currentStrategy];
          fuzzyTotalDurationMs = (unsigned long)aiDurationSec * 1000UL;
          fuzzyPulseOnMs       = sp.pulseOnSec * 1000;
          fuzzyPulseOffMs      = sp.pulseOffSec * 1000;
          fuzzyTotalWateredMs  = 0;
          fuzzySessionStart    = currentTime;

          digitalWrite(RELAY_PIN, RELAY_ON);
          if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            sharedData.pump_state = true;
            xSemaphoreGive(dataMutex);
          }
          fuzzyPulseStart = currentTime;
          fuzzyState      = FP_PULSE_ON;

          if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            mqttState.currentPumpStartTime  = getEpochMs();
            mqttState.currentPumpSoilBefore = soil;
            strncpy(mqttState.currentPumpMode, "AI_PREDICT", sizeof(mqttState.currentPumpMode) - 1);
            mqttState.pendingStatusPublish  = true;
            xSemaphoreGive(mqttStateMutex);
          }
          Serial.printf("[PUMP] AI started: %ds, strategy=%s (pulse %ds on / %ds off)\n",
            aiDurationSec,
            currentStrategy == STRAT_GENTLE ? "GENTLE" : currentStrategy == STRAT_NORMAL ? "NORMAL" : "AGGRESSIVE",
            sp.pulseOnSec, sp.pulseOffSec);
        }
      }

      if (fuzzyState == FP_PULSE_ON) {
        bool durationReached = (fuzzyTotalWateredMs + (currentTime - fuzzyPulseStart)) >= fuzzyTotalDurationMs;
        bool pulseComplete   = (fuzzyPulseOnMs > 0) && ((currentTime - fuzzyPulseStart) >= (unsigned long)fuzzyPulseOnMs);

        if (durationReached) {
          fuzzyTotalWateredMs  += (currentTime - fuzzyPulseStart);
          shouldFinishIrrigation = true;
        } else if (pulseComplete && fuzzyPulseOffMs > 0) {
          fuzzyTotalWateredMs += (currentTime - fuzzyPulseStart);
          digitalWrite(RELAY_PIN, RELAY_OFF);
          if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            sharedData.pump_state = false;
            xSemaphoreGive(dataMutex);
          }
          fuzzyPulseStart = currentTime;
          fuzzyState      = FP_PULSE_OFF;
          Serial.printf("[PUMP] AI pulse OFF → soak %ds (watered %lus/%lus)\n",
            fuzzyPulseOffMs / 1000, fuzzyTotalWateredMs / 1000, fuzzyTotalDurationMs / 1000);
        }
      }

      if (fuzzyState == FP_PULSE_OFF) {
        if ((currentTime - fuzzyPulseStart) >= (unsigned long)fuzzyPulseOffMs) {
          // FIX: dùng biến local `soil` đã đọc qua mutex ở đầu vòng lặp
          if (soil > 85.0f) {
            Serial.printf("[PUMP] AI: soil saturated (%.0f%%) → stop early\n", soil);
            shouldFinishIrrigation = true;
          } else {
            digitalWrite(RELAY_PIN, RELAY_ON);
            if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
              sharedData.pump_state = true;
              xSemaphoreGive(dataMutex);
            }
            fuzzyPulseStart = currentTime;
            fuzzyState      = FP_PULSE_ON;
            Serial.printf("[PUMP] AI pulse ON (soil now %.0f%%)\n", soil);
          }
        }
      }

      if (shouldFinishIrrigation) {
        digitalWrite(RELAY_PIN, RELAY_OFF);
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          sharedData.pump_state = false;
          xSemaphoreGive(dataMutex);
        }
        if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          unsigned long long endTime = getEpochMs();
          int duration = (endTime > mqttState.currentPumpStartTime)
                         ? (int)((endTime - mqttState.currentPumpStartTime) / 1000)
                         : 0;
          mqttState.aiIrrigationActive   = false;
          mqttState.historyStartTime     = mqttState.currentPumpStartTime;
          mqttState.historyEndTime       = endTime;
          mqttState.historyDuration      = duration;
          // historyWaterVolume đã xóa — cloud tự tính
          mqttState.historySoilBefore    = mqttState.currentPumpSoilBefore;
          mqttState.historySoilAfter     = soil;
          strncpy(mqttState.historyMode, mqttState.currentPumpMode, sizeof(mqttState.historyMode) - 1);
          mqttState.pendingHistoryPublish = true;
          mqttState.pendingStatusPublish  = true;
          xSemaphoreGive(mqttStateMutex);
        }
        fuzzyCooldownUntil  = currentTime + COOLDOWN_PERIOD;
        fuzzyLastSessionEnd = currentTime;
        fuzzyState          = FP_COOLDOWN;
        Serial.printf("[PUMP] AI irrigation complete (watered %lus / session %lus), cooldown started\n",
          fuzzyTotalWateredMs / 1000, (currentTime - fuzzySessionStart) / 1000);
        shouldFinishIrrigation = false;
      }
    }

    // ================================================================
    else {
      // FUZZY FALLBACK MODE: không có AI irrigation, fuzzy tự quyết cả duration
      // ================================================================
      switch (fuzzyState) {
        case FP_IDLE: {
          currentStrategy = computeIrrigationStrategy(soil, (float)rainPct, temp, hum, lightScaled);

          bool intervalOk = (currentTime - fuzzyLastSessionEnd >= MIN_FUZZY_INTERVAL_MS);
          if (currentStrategy != STRAT_SKIP && intervalOk) {
            const StrategyParams &sp = strategyTable[currentStrategy];
            fuzzyTotalDurationMs = (unsigned long)sp.fallbackDurationSec * 1000UL;
            fuzzyPulseOnMs       = sp.pulseOnSec * 1000;
            fuzzyPulseOffMs      = sp.pulseOffSec * 1000;
            fuzzyTotalWateredMs  = 0;
            fuzzySessionStart    = currentTime;

            digitalWrite(RELAY_PIN, RELAY_ON);
            if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
              sharedData.pump_state = true;
              xSemaphoreGive(dataMutex);
            }
            fuzzyPulseStart = currentTime;
            fuzzyState      = FP_PULSE_ON;

            if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
              mqttState.currentPumpStartTime  = getEpochMs();
              mqttState.currentPumpSoilBefore = soil;
              strncpy(mqttState.currentPumpMode, "FUZZY", sizeof(mqttState.currentPumpMode) - 1);
              mqttState.pendingStatusPublish  = true;
              xSemaphoreGive(mqttStateMutex);
            }
            Serial.printf("[PUMP] Fuzzy fallback started: %ds, strategy=%s (soil=%.0f rain=%d temp=%.1f)\n",
              sp.fallbackDurationSec,
              currentStrategy == STRAT_GENTLE ? "GENTLE" : currentStrategy == STRAT_NORMAL ? "NORMAL" : "AGGRESSIVE",
              soil, rainPct, temp);
          }
          break;
        }

        case FP_PULSE_ON: {
          bool durationReached = (fuzzyTotalWateredMs + (currentTime - fuzzyPulseStart)) >= fuzzyTotalDurationMs;
          bool pulseComplete   = (fuzzyPulseOnMs > 0) && ((currentTime - fuzzyPulseStart) >= (unsigned long)fuzzyPulseOnMs);

          if (durationReached) {
            fuzzyTotalWateredMs   += (currentTime - fuzzyPulseStart);
            shouldFinishIrrigation = true;
          } else if (pulseComplete && fuzzyPulseOffMs > 0) {
            fuzzyTotalWateredMs += (currentTime - fuzzyPulseStart);
            digitalWrite(RELAY_PIN, RELAY_OFF);
            if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
              sharedData.pump_state = false;
              xSemaphoreGive(dataMutex);
            }
            fuzzyPulseStart = currentTime;
            fuzzyState      = FP_PULSE_OFF;
            Serial.printf("[PUMP] Fuzzy pulse OFF → soak %ds\n", fuzzyPulseOffMs / 1000);
          }
          break;
        }

        case FP_PULSE_OFF: {
          if ((currentTime - fuzzyPulseStart) >= (unsigned long)fuzzyPulseOffMs) {
            // FIX: dùng biến local `soil` đã đọc qua mutex ở đầu vòng lặp
            if (soil > 85.0f) {
              Serial.printf("[PUMP] Fuzzy: soil saturated (%.0f%%) → stop early\n", soil);
              shouldFinishIrrigation = true;
            } else {
              digitalWrite(RELAY_PIN, RELAY_ON);
              if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                sharedData.pump_state = true;
                xSemaphoreGive(dataMutex);
              }
              fuzzyPulseStart = currentTime;
              fuzzyState      = FP_PULSE_ON;
              Serial.printf("[PUMP] Fuzzy pulse ON (soil now %.0f%%)\n", soil);
            }
          }
          break;
        }

        case FP_COOLDOWN: {
          if (currentTime >= fuzzyCooldownUntil) {
            fuzzyState = FP_IDLE;
            Serial.println("[PUMP] Cooldown finished, back to IDLE");
          }
          break;
        }
      }

      if (shouldFinishIrrigation) {
        digitalWrite(RELAY_PIN, RELAY_OFF);
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          sharedData.pump_state = false;
          xSemaphoreGive(dataMutex);
        }
        if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          unsigned long long endTime = getEpochMs();
          int duration = (endTime > mqttState.currentPumpStartTime)
                         ? (int)((endTime - mqttState.currentPumpStartTime) / 1000)
                         : 0;
          mqttState.historyStartTime      = mqttState.currentPumpStartTime;
          mqttState.historyEndTime        = endTime;
          mqttState.historyDuration       = duration;
          // historyWaterVolume đã xóa — cloud tự tính
          mqttState.historySoilBefore     = mqttState.currentPumpSoilBefore;
          mqttState.historySoilAfter      = soil;
          strncpy(mqttState.historyMode, mqttState.currentPumpMode, sizeof(mqttState.historyMode) - 1);
          mqttState.pendingHistoryPublish = true;
          mqttState.pendingStatusPublish  = true;
          xSemaphoreGive(mqttStateMutex);
        }
        fuzzyCooldownUntil  = currentTime + COOLDOWN_PERIOD;
        fuzzyLastSessionEnd = currentTime;
        fuzzyState          = FP_COOLDOWN;
        Serial.printf("[PUMP] Fuzzy fallback finished (watered %lus), cooldown started\n",
          fuzzyTotalWateredMs / 1000);
        shouldFinishIrrigation = false;
      }
    }

    vTaskDelay(pdMS_TO_TICKS(500));
  }
}


void displayTask(void *pvParameters) {
  DisplayData displayData;
  bool lastWifiOk = false;
  bool lastMqttOk = false;
  bool lastWebAppOk = false;
  bool wasPairingMode = false;
  
  vTaskDelay(pdMS_TO_TICKS(1000));
  drawStaticUI();
  
  while(1) {
    // === PAIRING MODE: hiển thị màn hình pairing ===
    if (pairingMode) {
      if (!wasPairingMode) {
        // Vừa vào pairing mode → vẽ màn hình pairing
        if (xSemaphoreTake(tftMutex, pdMS_TO_TICKS(500)) == pdTRUE) {
          tft.fillScreen(ST77XX_BLACK);

          // Header
          tft.fillRect(0, 0, 160, 18, 0xF800);  // Red header
          tft.setTextColor(ST77XX_WHITE);
          tft.setTextSize(1);
          tft.setCursor(15, 5);
          tft.print("PAIRING MODE");

          // Animated-like icon
          tft.setTextColor(ST77XX_YELLOW);
          tft.setCursor(10, 28);
          tft.print("Waiting for new");
          tft.setCursor(10, 40);
          tft.print("account to pair...");

          // MAC Address
          tft.drawFastHLine(0, 55, 160, ST77XX_MAGENTA);
          tft.setTextColor(ST77XX_CYAN);
          tft.setCursor(10, 62);
          tft.print("Device MAC:");
          tft.setTextColor(ST77XX_WHITE);
          tft.setCursor(10, 76);
          tft.print(deviceCode.c_str());

          // Instructions
          tft.drawFastHLine(0, 90, 160, ST77XX_MAGENTA);
          tft.setTextColor(0xBDF7);  // Light gray
          tft.setCursor(10, 98);
          tft.print("Add this device in");
          tft.setCursor(10, 110);
          tft.print("web app to connect");

          xSemaphoreGive(tftMutex);
        }
        wasPairingMode = true;
        Serial.println("[DISPLAY] Pairing mode screen shown");
      }

      // Animation: dấu chấm nhấp nháy
      static unsigned long lastBlink = 0;
      static bool blinkState = false;
      if (millis() - lastBlink > 800) {
        lastBlink = millis();
        blinkState = !blinkState;
        if (xSemaphoreTake(tftMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          tft.fillRect(120, 40, 30, 10, ST77XX_BLACK);
          if (blinkState) {
            tft.setTextColor(ST77XX_YELLOW);
            tft.setCursor(120, 40);
            tft.print("...");
          }
          xSemaphoreGive(tftMutex);
        }
      }

      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    // === Thoát pairing mode: vẽ lại UI bình thường ===
    if (wasPairingMode && !pairingMode) {
      drawStaticUI();
      wasPairingMode = false;
      // Reset tracked states để force cập nhật dots
      lastWifiOk = false;
      lastMqttOk = false;
      lastWebAppOk = false;
      Serial.println("[DISPLAY] Exited pairing mode, UI restored");
    }

    // === Chế độ bình thường ===
    // Dùng timeout 1s thay vì portMAX_DELAY để cập nhật connection dots định kỳ
    if (xQueueReceive(displayQueue, &displayData, pdMS_TO_TICKS(1000)) == pdTRUE) {
      updateScreen(displayData);
    }

    // Cập nhật connection status dots (chỉ vẽ lại khi thay đổi)
    bool currentWifiOk = (WiFi.status() == WL_CONNECTED);
    bool currentMqttOk = mqttClient.connected();
    bool currentWebAppOk = webAppRegistered;
    if (currentWifiOk != lastWifiOk || currentMqttOk != lastMqttOk || currentWebAppOk != lastWebAppOk) {
      updateConnectionDots(currentWifiOk, currentMqttOk, currentWebAppOk);
      lastWifiOk = currentWifiOk;
      lastMqttOk = currentMqttOk;
      lastWebAppOk = currentWebAppOk;
    }

    taskYIELD();
  }
}

void serialTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  SensorData localData;
  char lineBuf[80];
  int  lineLen = 0;

  Serial.println();
  Serial.println("=== Serial Command Interface ===");
  Serial.println("Type 'help' for commands.");

  while(1) {
    // === Đọc và parse lệnh từ Serial khi có dữ liệu ===
    while (Serial.available()) {
      char c = Serial.read();
      if (c == '\n' || c == '\r') {
        if (lineLen == 0) continue;
        lineBuf[lineLen] = '\0';
        lineLen = 0;

        // --- Parse lệnh ---
        char cmd[20], arg1[20], arg2[20], arg3[20], arg4[20], arg5[20], arg6[20], arg7[20];
        arg2[0]=arg3[0]=arg4[0]=arg5[0]=arg6[0]=arg7[0]='\0';
        int n = sscanf(lineBuf, "%19s %19s %19s %19s %19s %19s %19s %19s",
                       cmd, arg1, arg2, arg3, arg4, arg5, arg6, arg7);

        if (strcasecmp(cmd, "help") == 0) {
          Serial.println("--- DEV MODE Commands ---");
          Serial.println("  dev on/off           - bật/tắt dev mode");
          Serial.println("  dev auto on/off      - bật/tắt auto-random");
          Serial.println("  dev status           - hiển trạng thái hiện tại");
          Serial.println("  set soil1 <0-100>  - độ ẩm đất 1");
          Serial.println("  set soil2 <0-100>  - độ ẩm đất 2");
          Serial.println("  set rain  <0-100>  - mưa");
          Serial.println("  set temp  <val>    - nhiệt độ (°C)");
          Serial.println("  set hum   <val>    - độ ẩm KK (%)");
          Serial.println("  set lux   <val>    - ánh sáng (lux)");
          Serial.println("  preset dry         - S1=10 S2=10 Rain=0 Tmp=32 Hum=40 Lux=800");
          Serial.println("  preset moist       - S1=55 S2=55 Rain=0 Tmp=25 Hum=70 Lux=300");
          Serial.println("  preset wet         - S1=85 S2=85 Rain=60 Tmp=22 Hum=90 Lux=100");
          Serial.println("  preset rain        - S1=40 S2=40 Rain=80 Tmp=22 Hum=95 Lux=50");
          Serial.println("  preset manual <s1> <s2> <rain> <tmp> <hum> <lux>  - gia tri tuy bien");
          Serial.println("    vi du: preset manual 20 25 5 30.5 65 600");
          Serial.println("--- Other ---");
          Serial.println("  status             - in sensor hiện tại");

        } else if (strcasecmp(cmd, "dev") == 0) {
          if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
            if (n >= 2 && strcasecmp(arg1, "on") == 0) {
              devMode.active = true;
              Serial.println("[DEV] Dev mode ON");
            } else if (n >= 2 && strcasecmp(arg1, "off") == 0) {
              devMode.active = false;
              devMode.autoRand = false;
              Serial.println("[DEV] Dev mode OFF - using real sensors");
            } else if (n >= 3 && strcasecmp(arg1, "auto") == 0 && strcasecmp(arg2, "on") == 0) {
              devMode.active = true;
              devMode.autoRand = true;
              Serial.println("[DEV] Auto-random ON");
            } else if (n >= 3 && strcasecmp(arg1, "auto") == 0 && strcasecmp(arg2, "off") == 0) {
              devMode.autoRand = false;
              Serial.println("[DEV] Auto-random OFF");
            } else if (n >= 2 && strcasecmp(arg1, "status") == 0) {
              Serial.printf("[DEV] active=%s autoRand=%s\n",
                devMode.active ? "ON" : "OFF", devMode.autoRand ? "ON" : "OFF");
              Serial.printf("[DEV] soil1=%d%% soil2=%d%% rain=%d%% temp=%.1fC hum=%.0f%% lux=%.0f\n",
                devMode.soil1, devMode.soil2, devMode.rain, devMode.temp, devMode.hum, devMode.lux);
            } else {
              Serial.println("[DEV] Usage: dev on | dev off | dev auto on/off | dev status");
            }
            xSemaphoreGive(devModeMutex);
          }

        } else if (strcasecmp(cmd, "set") == 0 && n >= 3) {
          float val = atof(arg2);
          if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
            if (!devMode.active) {
              devMode.active = true;
              Serial.println("[DEV] Dev mode auto-enabled");
            }
            if      (strcasecmp(arg1, "soil1") == 0) { devMode.soil1 = constrain((int)val, 0, 100); Serial.printf("[DEV] soil1 = %d%%\n", devMode.soil1); }
            else if (strcasecmp(arg1, "soil2") == 0) { devMode.soil2 = constrain((int)val, 0, 100); Serial.printf("[DEV] soil2 = %d%%\n", devMode.soil2); }
            else if (strcasecmp(arg1, "rain")  == 0) { devMode.rain  = constrain((int)val, 0, 100); Serial.printf("[DEV] rain  = %d%%\n", devMode.rain);  }
            else if (strcasecmp(arg1, "temp")  == 0) { devMode.temp  = constrain(val, -10.0f, 60.0f); Serial.printf("[DEV] temp  = %.1fC\n", devMode.temp);  }
            else if (strcasecmp(arg1, "hum")   == 0) { devMode.hum   = constrain(val, 0.0f, 100.0f);  Serial.printf("[DEV] hum   = %.0f%%\n", devMode.hum);   }
            else if (strcasecmp(arg1, "lux")   == 0) { devMode.lux   = constrain(val, 0.0f, 100000.0f); Serial.printf("[DEV] lux = %.0f\n", devMode.lux); }
            else    { Serial.printf("[DEV] Unknown field: %s\n", arg1); }
            xSemaphoreGive(devModeMutex);
          }

        } else if (strcasecmp(cmd, "preset") == 0 && n >= 2) {
          if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
            devMode.active = true;
            devMode.autoRand = false;
            if (strcasecmp(arg1, "dry") == 0) {
              devMode.soil1=10; devMode.soil2=10; devMode.rain=0;
              devMode.temp=32.0f; devMode.hum=40.0f; devMode.lux=800.0f;
              Serial.println("[DEV] Preset: DRY");
            } else if (strcasecmp(arg1, "moist") == 0) {
              devMode.soil1=55; devMode.soil2=55; devMode.rain=0;
              devMode.temp=25.0f; devMode.hum=70.0f; devMode.lux=300.0f;
              Serial.println("[DEV] Preset: MOIST");
            } else if (strcasecmp(arg1, "wet") == 0) {
              devMode.soil1=85; devMode.soil2=85; devMode.rain=60;
              devMode.temp=22.0f; devMode.hum=90.0f; devMode.lux=100.0f;
              Serial.println("[DEV] Preset: WET");
            } else if (strcasecmp(arg1, "rain") == 0) {
              devMode.soil1=40; devMode.soil2=40; devMode.rain=80;
              devMode.temp=22.0f; devMode.hum=95.0f; devMode.lux=50.0f;
              Serial.println("[DEV] Preset: RAINING");
            } else if (strcasecmp(arg1, "manual") == 0) {
              // preset manual <soil1> <soil2> <rain> <temp> <hum> <lux>
              if (n >= 8) {
                devMode.soil1 = constrain(atoi(arg2),  0, 100);
                devMode.soil2 = constrain(atoi(arg3),  0, 100);
                devMode.rain  = constrain(atoi(arg4),  0, 100);
                devMode.temp  = constrain(atof(arg5), -10.0f, 60.0f);
                devMode.hum   = constrain(atof(arg6),  0.0f, 100.0f);
                devMode.lux   = constrain(atof(arg7),  0.0f, 100000.0f);
                Serial.printf("[DEV] Preset MANUAL: S1=%d%% S2=%d%% Rain=%d%% Tmp=%.1fC Hum=%.0f%% Lux=%.0f\n",
                  devMode.soil1, devMode.soil2, devMode.rain, devMode.temp, devMode.hum, devMode.lux);
              } else {
                Serial.println("[DEV] Usage: preset manual <soil1> <soil2> <rain> <temp> <hum> <lux>");
                Serial.println("[DEV]   vi du: preset manual 20 25 5 30.5 65 600");
              }
            } else {
              Serial.println("[DEV] Presets: dry | moist | wet | rain | manual");
            }
            xSemaphoreGive(devModeMutex);
          }

        } else if (strcasecmp(cmd, "status") == 0) {
          // In toàn bộ sensor hiện tại (dùng giá trị đang trong sharedData)
          memset(&localData, 0, sizeof(SensorData));
          if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            memcpy(&localData, &sharedData, sizeof(SensorData));
            xSemaphoreGive(dataMutex);
          }
          bool devOn = false;
          if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
            devOn = devMode.active; xSemaphoreGive(devModeMutex);
          }
          Serial.printf("[STATUS%s] Temp:%.1fC Hum:%.0f%% Lux:%.0f Rain:%d%% Soil1:%d%% Soil2:%d%% Pump:%s\n",
            devOn ? " (DEV)" : "",
            localData.temperature, localData.humidity, localData.lux,
            localData.rain_percent, localData.soil1_percent, localData.soil2_percent,
            localData.pump_state ? "ON" : "OFF");

        } else {
          Serial.printf("[CMD] Unknown: '%s' — type 'help'\n", cmd);
        }

      } else {
        // Accumulate character
        if (lineLen < (int)sizeof(lineBuf) - 1) {
          lineBuf[lineLen++] = c;
        }
      }
    }

    // === In định kỳ (mỗi 5s) — chỉ khi không có serial input để tránh spam ===
    static TickType_t lastPrint = 0;
    if (xTaskGetTickCount() - lastPrint >= pdMS_TO_TICKS(5000)) {
      lastPrint = xTaskGetTickCount();
      if (!pairingMode) {
        memset(&localData, 0, sizeof(SensorData));
        if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          memcpy(&localData, &sharedData, sizeof(SensorData));
          xSemaphoreGive(dataMutex);
        }
        bool devOn = false;
        if (xSemaphoreTake(devModeMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
          devOn = devMode.active; xSemaphoreGive(devModeMutex);
        }
        if (localData.timestamp > 0) {
          Serial.printf("%s Temp:%.1fC Hum:%.0f%% Lux:%.0f Rain:%d%% Soil1:%d%% Soil2:%d%% Pump:%s\n",
            devOn ? "[DEV]" : "[SEN]",
            localData.temperature, localData.humidity, localData.lux,
            localData.rain_percent, localData.soil1_percent, localData.soil2_percent,
            localData.pump_state ? "ON" : "OFF");
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(50));  // poll serial mỗi 50ms (không cần DelayUntil)
  }
}

// =============================================================
// BUTTON ISR
// =============================================================
void IRAM_ATTR buttonISR() {
  btnISRTime = millis();
  btnISRFlag = true;
  // Notify task từ ISR
  BaseType_t xHigherPriorityTaskWoken = pdFALSE;
  if (btnTaskHandle != NULL) {
    vTaskNotifyGiveFromISR(btnTaskHandle, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
  }
}

// =============================================================
// BUTTON TASK - State Machine
// =============================================================
void buttonTask(void *pvParameters) {
  ButtonState state       = BTN_IDLE;
  unsigned long pressTime   = 0;
  unsigned long releaseTime = 0;
  bool lastBtnState       = HIGH;   // Pull-up → idle HIGH

  while (1) {
    // Đợi ISR notification hoặc timeout 10ms (để xử lý timeout states)
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(10));

    bool currentBtn = digitalRead(BUTTON_PIN);
    unsigned long now = millis();

    switch (state) {
      // -------------------------------------------------------
      case BTN_IDLE:
        if (currentBtn == LOW && lastBtnState == HIGH) {
          // Nút vừa được nhấn → debounce
          vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
          if (digitalRead(BUTTON_PIN) == LOW) {
            pressTime = now;
            state = BTN_PRESSED;
            Serial.println("[BTN] PRESSED (1st)");
          }
        }
        break;

      // -------------------------------------------------------
      case BTN_PRESSED:
        if (currentBtn == HIGH && lastBtnState == LOW) {
          // Nút vừa thả → debounce
          vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
          if (digitalRead(BUTTON_PIN) == HIGH) {
            releaseTime = millis();
            unsigned long pressDuration = releaseTime - pressTime;

            if (pressDuration <= SINGLE_CLICK_MAX_MS) {
              // Có thể là single click, đợi thêm để xem có double click không
              state = BTN_RELEASED_ONCE;
              Serial.printf("[BTN] RELEASED (1st) duration=%lums\n", pressDuration);
            } else {
              // Nhấn giữ quá lâu → bỏ qua
              Serial.printf("[BTN] Long press ignored (%lums)\n", pressDuration);
              state = BTN_IDLE;
            }
          }
        }
        break;

      // -------------------------------------------------------
      case BTN_RELEASED_ONCE:
        if (currentBtn == LOW && lastBtnState == HIGH) {
          // Nhấn lần 2 → debounce
          vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
          if (digitalRead(BUTTON_PIN) == LOW) {
            unsigned long gap = millis() - releaseTime;

            if (gap <= DOUBLE_CLICK_GAP_MS) {
              // ✅ Nhấn lần 2 trong khoảng cho phép → DOUBLE CLICK
              state = BTN_PRESSED_SECOND;
              Serial.printf("[BTN] PRESSED (2nd) gap=%lums → DOUBLE CLICK\n", gap);
            } else {
              // Quá chậm → xem như single click mới
              pressTime = millis();
              state = BTN_PRESSED;
              Serial.printf("[BTN] Gap too long (%lums), treat as new press\n", gap);
            }
          }
        }
        // Timeout: nếu quá CLICK_TIMEOUT_MS mà không nhấn lần 2 → SINGLE CLICK
        else if ((now - releaseTime) > CLICK_TIMEOUT_MS) {
          // ✅ SINGLE CLICK → Toggle bơm
          Serial.println("[BTN] >> SINGLE CLICK → Toggle PUMP");

          bool currentPump = false;
          float currentSoil = 0;
          if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
            currentPump = sharedData.pump_state;
            sharedData.pump_state = !currentPump;
            currentSoil = sharedData.soil1_percent;
            xSemaphoreGive(dataMutex);
          }
          digitalWrite(RELAY_PIN, !currentPump ? RELAY_ON : RELAY_OFF);

          // Đặt manual mode và history
          if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
            mqttState.manualMode = true;
            mqttState.pendingStatusPublish = true;
            
            if (!currentPump) {
              // Bật bơm
              mqttState.currentPumpStartTime = getEpochMs();
              mqttState.currentPumpSoilBefore = currentSoil;
              strncpy(mqttState.currentPumpMode, "MANUAL_LOCAL", sizeof(mqttState.currentPumpMode) - 1);
            } else {
              // Tắt bơm
              unsigned long long endTime = getEpochMs();
              int duration = (endTime > mqttState.currentPumpStartTime) ? (endTime - mqttState.currentPumpStartTime) / 1000 : 0;
              
              mqttState.historyStartTime = mqttState.currentPumpStartTime;
              mqttState.historyEndTime = endTime;
              mqttState.historyDuration = duration;
              mqttState.historySoilBefore = mqttState.currentPumpSoilBefore;
              mqttState.historySoilAfter = currentSoil;
              strncpy(mqttState.historyMode, mqttState.currentPumpMode, sizeof(mqttState.historyMode) - 1);
              mqttState.pendingHistoryPublish = true;
            }
            
            xSemaphoreGive(mqttStateMutex);
          }
          Serial.printf("[BTN] Pump → %s\n", !currentPump ? "ON" : "OFF");

          state = BTN_IDLE;
        }
        break;

      // -------------------------------------------------------
      case BTN_PRESSED_SECOND:
        if (currentBtn == HIGH && lastBtnState == LOW) {
          // Thả nút lần 2 → xác nhận double click
          vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));
          if (digitalRead(BUTTON_PIN) == HIGH) {
            // ✅ DOUBLE CLICK → Toggle đèn
            Serial.println("[BTN] >> DOUBLE CLICK → Toggle LIGHT");

            bool currentLight = false;
            if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
              currentLight = sharedData.light_state;
              sharedData.light_state = !currentLight;
              xSemaphoreGive(dataMutex);
            }
            digitalWrite(LIGHT_RELAY_PIN, !currentLight ? RELAY_ON : RELAY_OFF);

            // Publish status
            if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
              mqttState.pendingStatusPublish = true;
              xSemaphoreGive(mqttStateMutex);
            }
            Serial.printf("[BTN] Light → %s\n", !currentLight ? "ON" : "OFF");

            state = BTN_IDLE;
          }
        }
        break;
    }

    lastBtnState = currentBtn;
  }
}

// =============================================================
// BOOT BUTTON TASK - Long Press GPIO 0 → Pairing Mode
// =============================================================
void bootButtonTask(void *pvParameters) {
  bool wasPressed = false;
  unsigned long pressStartTime = 0;
  
  vTaskDelay(pdMS_TO_TICKS(3000));  // Đợi hệ thống ổn định (tránh bắt nhầm lúc boot)
  Serial.println("[BOOT_BTN] Task started, monitoring GPIO 0");

  while (1) {
    bool isPressed = (digitalRead(BOOT_BUTTON_PIN) == LOW);

    if (isPressed && !wasPressed) {
      pressStartTime = millis();
      wasPressed = true;
      Serial.println("[BOOT_BTN] BOOT button pressed");
    }
    else if (isPressed && wasPressed) {
      unsigned long holdDuration = millis() - pressStartTime;
      if (holdDuration >= LONG_PRESS_MS && !pairingMode) {
        Serial.println("[BOOT_BTN] >> LONG PRESS 3s → ENTERING PAIRING MODE");

        // Reset registration + vào pairing mode
        webAppRegistered = false;
        pairingMode = true;  // Các task khác sẽ tự dừng

        // Publish DEVICE_UNLINKED lên MQTT
        if (mqttClient.connected()) {
          JsonDocument doc;
          doc["action"] = "DEVICE_UNLINKED";
          doc["ts"] = (long long)getEpochMs();
          char buffer[128];
          serializeJson(doc, buffer, sizeof(buffer));
          mqttClient.publish(topicRegistration.c_str(), buffer, true);
          Serial.println("[BOOT_BTN] Published DEVICE_UNLINKED");
          publishStatus();
        }

        Serial.printf("[BOOT_BTN] Pairing mode active - MAC: %s\n", deviceCode.c_str());
        Serial.println("[BOOT_BTN] Sensor/Pump/Serial tasks suspended");
        Serial.println("[BOOT_BTN] Waiting for DEVICE_REGISTERED from web app...");

        // Đợi người dùng thả nút
        while (digitalRead(BOOT_BUTTON_PIN) == LOW) {
          vTaskDelay(pdMS_TO_TICKS(50));
        }
        wasPressed = false;
      }
    }
    else if (!isPressed && wasPressed) {
      unsigned long holdDuration = millis() - pressStartTime;
      Serial.printf("[BOOT_BTN] Released after %lums (< 3s, ignored)\n", holdDuration);
      wasPressed = false;
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// =============================================================
// MQTT TASK
// =============================================================
void mqttTask(void *pvParameters) {
  unsigned long lastSensorPublish    = 0;
  unsigned long lastHeartbeatPublish = 0;
  unsigned long lastReconnectAttempt = 0;

  // Đợi WiFi ổn định
  vTaskDelay(pdMS_TO_TICKS(2000));

  while(1) {
    unsigned long now = millis();

    // --- Kiểm tra kết nối ---
    if (!mqttClient.connected()) {
      if (now - lastReconnectAttempt > MQTT_RECONNECT_INTERVAL_MS) {
        lastReconnectAttempt = now;
        if (mqttConnect()) {
          lastReconnectAttempt = 0;
          // Reset timers sau khi reconnect
          lastSensorPublish    = now;
          lastHeartbeatPublish = now;
        }
      }
    } else {
      // --- MQTT loop (xử lý incoming messages) ---
      mqttClient.loop();

      // === Khi đang pairing: chỉ giữ kết nối + heartbeat, không publish sensor ===
      if (pairingMode) {
        // Vẫn gửi heartbeat để không bị disconnect
        if (now - lastHeartbeatPublish >= MQTT_HEARTBEAT_INTERVAL_MS) {
          lastHeartbeatPublish = now;
          publishHeartbeat();
        }
        vTaskDelay(pdMS_TO_TICKS(MQTT_LOOP_INTERVAL_MS));
        continue;
      }

      // --- Publish sensor data định kỳ ---
      if (now - lastSensorPublish >= MQTT_SENSOR_INTERVAL_MS) {
        lastSensorPublish = now;
        publishSensorData();
      }

      // --- Publish heartbeat định kỳ ---
      if (now - lastHeartbeatPublish >= MQTT_HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatPublish = now;
        publishHeartbeat();
      }

      // 5. Kiểm tra pending event
      bool needHistoryPublish = false;
      bool needStatusPublish = false;
      
      if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        if (mqttState.pendingHistoryPublish) {
          needHistoryPublish = true;
        }
        if (mqttState.pendingStatusPublish) {
          needStatusPublish = true;
        }
        xSemaphoreGive(mqttStateMutex);
      }
      
      if (needHistoryPublish) {
        publishHistory();
      }
      
      if (needStatusPublish) {
        publishStatus();
      }
    }

    vTaskDelay(pdMS_TO_TICKS(MQTT_LOOP_INTERVAL_MS));
  }
}

// =============================================================
// WIFI + MQTT INIT
// =============================================================
void initWiFi() {
  Serial.println("[WiFi] Starting WiFiManager...");

  // Load saved MQTT config TRƯỚC khi tạo WiFiManagerParameter
  // Nếu không load trước, getValue() sẽ trả về default khi portal không mở (auto-connect)
  // dẫn đến Preferences bị ghi đè bằng default → mất config sau reset
  loadMqttConfig();

  WiFiManager wm;

  // Custom CSS: giao diện dark garden theme
  wm.setTitle("Smart Garden Setup");
  const char* customHead =
    "<style>"
    "body{font-family:Arial,sans-serif;background:#141f14;color:#d4f0d4;margin:0;padding:0}"
    ".w{max-width:420px;margin:auto;padding:24px 16px}"
    "h1{color:#4caf50;text-align:center;font-size:22px;margin-bottom:4px}"
    ".c{text-align:center;color:#81c784;font-size:13px;margin-bottom:24px}"
    "label{display:block;margin:14px 0 4px;color:#a5d6a7;font-size:13px}"
    "input[type=text],input[type=password],select{"
      "background:#1e331e;color:#d4f0d4;border:1px solid #4caf50;"
      "border-radius:6px;padding:10px 12px;width:100%;box-sizing:border-box;font-size:14px}"
    "input[type=text]:focus,input[type=password]:focus{"
      "outline:none;border-color:#81c784;box-shadow:0 0 0 2px rgba(76,175,80,.25)}"
    "input[type=submit],button{"
      "background:#4caf50;color:#fff;border:none;border-radius:6px;"
      "padding:13px;width:100%;font-size:15px;font-weight:bold;cursor:pointer;margin-top:10px}"
    "input[type=submit]:hover,button:hover{background:#43a047}"
    ".msg{background:#1e331e;border-left:4px solid #4caf50;padding:12px 14px;"
      "border-radius:0 6px 6px 0;margin:10px 0;font-size:13px}"
    ".s{background:#1e331e;border-left:4px solid #f44336;}"
    "a{color:#81c784}hr{border:none;border-top:1px solid #2e4a2e;margin:18px 0}"
    ".info-box{background:#1a2f1a;border:1px solid #2e5c2e;border-radius:8px;"
      "padding:10px 14px;margin:12px 0;font-size:12px;color:#81c784}"
    ".info-box b{color:#a5d6a7}"
    "</style>";
  wm.setCustomHeadElement(customHead);

  // Hiển thị MAC address như info box (readonly)
  char infoHtml[160];
  snprintf(infoHtml, sizeof(infoHtml),
    "<div class='info-box'>&#127807; Device MAC: <b>%s</b></div>",
    getDeviceCode().c_str());
  WiFiManagerParameter device_info(infoHtml);

  // Custom parameters cho MQTT
  WiFiManagerParameter custom_mqtt_server("server", "MQTT Broker IP", mqtt_server, 40);
  WiFiManagerParameter custom_mqtt_port("port", "MQTT Port", mqtt_port, 6);

  wm.addParameter(&device_info);
  wm.addParameter(&custom_mqtt_server);
  wm.addParameter(&custom_mqtt_port);

  // Tạo AP name dựa trên MAC
  String apName = "SmartGarden_" + getDeviceCode().substring(8);  // Last 4 chars
  
  // Timeout AP portal sau 180s
  wm.setConfigPortalTimeout(180);

  // autoConnect: nếu đã có WiFi saved → connect luôn, nếu chưa → mở portal
  bool connected = wm.autoConnect(apName.c_str(), "");

  if (!connected) {
    Serial.println("[WiFi] Failed to connect. Restarting...");
    delay(3000);
    ESP.restart();
  }

  Serial.printf("[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());

  // Đọc custom params
  strncpy(mqtt_server, custom_mqtt_server.getValue(), sizeof(mqtt_server) - 1);
  strncpy(mqtt_port, custom_mqtt_port.getValue(), sizeof(mqtt_port) - 1);

  // Lưu vào Preferences (NVS) để dùng lại khi reboot
  preferences.begin("mqtt", false);
  preferences.putString("server", mqtt_server);
  preferences.putString("port", mqtt_port);
  preferences.end();

  Serial.printf("[WiFi] MQTT config: %s:%s\n", mqtt_server, mqtt_port);
}

void loadMqttConfig() {
  preferences.begin("mqtt", true);  // read-only
  String savedServer = preferences.getString("server", DEFAULT_MQTT_SERVER);
  String savedPort   = preferences.getString("port", DEFAULT_MQTT_PORT);
  preferences.end();

  strncpy(mqtt_server, savedServer.c_str(), sizeof(mqtt_server) - 1);
  strncpy(mqtt_port, savedPort.c_str(), sizeof(mqtt_port) - 1);
}

void initMQTT() {
  // Load saved config trước
  loadMqttConfig();

  // Device code từ MAC
  deviceCode = getDeviceCode();
  Serial.printf("[MQTT] DeviceCode: %s\n", deviceCode.c_str());

  // Build topic strings
  buildTopics();

  // Configure PubSubClient
  mqttClient.setServer(mqtt_server, atoi(mqtt_port));
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(MQTT_BUFFER_SIZE);
  mqttClient.setKeepAlive(MQTT_KEEPALIVE);

  // cleanSession = false → set via connect() params (PubSubClient default)
  // Lưu ý: PubSubClient.connect() mặc định cleanSession=true
  // Cần dùng connect() overload với cleanSession=false (nếu cần)
  // PubSubClient 2.8+ hỗ trợ setCleanSession
  // Workaround: dùng bản PubSubClient mới nhất

  Serial.printf("[MQTT] Configured: %s:%s\n", mqtt_server, mqtt_port);
  Serial.printf("[MQTT] Topics prefix: smart_garden/devices/%s/\n", deviceCode.c_str());
}

void initNTP() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  Serial.println("[NTP] Syncing time...");
  
  // Đợi NTP sync (tối đa 10s)
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 10) {
    Serial.print(".");
    delay(1000);
    retry++;
  }
  
  if (getLocalTime(&timeinfo, 10000)) {
    Serial.println("[NTP] Sync OK!");
  } else {
    Serial.println("\n[NTP] Sync failed (will retry later)");
  }
}

// =============================================================
void fetchGeoLocation() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[GEO] Fetching geographic location via IP...");
    HTTPClient http;
    http.begin("http://ip-api.com/json/");
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error && doc["status"] == "success") {
        geoLatitude = doc["lat"];
        geoLongitude = doc["lon"];
        geoCity = doc["city"].as<String>();
        geoRegion = doc["regionName"].as<String>();
        geoCountry = doc["country"].as<String>();
        geoResolved = true;
        Serial.printf("[GEO] Location resolved: %.4f, %.4f (%s, %s)\n", geoLatitude, geoLongitude, geoCity.c_str(), geoCountry.c_str());
      } else {
        Serial.println("[GEO] Failed to parse JSON or status != success");
      }
    } else {
      Serial.printf("[GEO] HTTP GET failed, code: %d\n", httpCode);
    }
    http.end();
  }
}

// =============================================================
// SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("========================================");
  Serial.println("   Smart Garden - ESP32-S3 Firmware");
  Serial.println("========================================");

  // Relays
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  
  pinMode(LIGHT_RELAY_PIN, OUTPUT);
  digitalWrite(LIGHT_RELAY_PIN, RELAY_OFF);

  // Button: INPUT_PULLUP (idle HIGH, nhấn = LOW)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // BOOT button (GPIO 0): trên board ESP32-S3 đã có pull-up
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  // ===========================================================
  // FACTORY RESET: Giữ BOOT khi khởi động = xóa toàn bộ cấu hình
  // ===========================================================
  delay(100);  // Đợi GPIO ổn định
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    Serial.println("[SETUP] BOOT button held during startup!");
    Serial.println("[SETUP] Waiting 2s to confirm factory reset...");
    delay(2000);
    
    // Kiểm tra lại để chắc chắn user vẫn giữ nút
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
      Serial.println("[SETUP] >>> FACTORY RESET CONFIRMED <<<");
      
      // Xóa WiFi saved credentials
      WiFiManager wm;
      wm.resetSettings();
      Serial.println("[SETUP] WiFi settings cleared");

      // Xóa MQTT config
      preferences.begin("mqtt", false);
      preferences.clear();
      preferences.end();
      Serial.println("[SETUP] MQTT config cleared");

      Serial.println("[SETUP] All config erased. Restarting...");
      delay(1000);
      ESP.restart();
    } else {
      Serial.println("[SETUP] BOOT button released, skipping factory reset");
    }
  }
  
  // ADC config
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // I2C init
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);

  // SHT41
  if (!sht4.begin()) {
    Serial.println("[ERROR] SHT41");
  } else {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);
    Serial.println("[OK] SHT41");
  }

  // BH1750
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[WARN] BH1750 init failed, sensorTask will retry");
    bh1750Ready = false;
  } else {
    Serial.println("[OK] BH1750");
    bh1750Ready = true;
  }

  // TFT
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);
  Serial.println("[OK] TFT");

  // Hiển thị "Connecting..." trên TFT
  tft.setTextColor(ST77XX_YELLOW);
  tft.setTextSize(1);
  tft.setCursor(20, 60);
  tft.print("Connecting WiFi...");

  // ---- WiFi + NTP + GEO + MQTT ----
  initWiFi();
  initNTP();
  fetchGeoLocation();
  initMQTT();

  // ---- FreeRTOS objects ----
  dataMutex      = xSemaphoreCreateMutex();
  tftMutex       = xSemaphoreCreateMutex();
  mqttStateMutex = xSemaphoreCreateMutex();
  devModeMutex   = xSemaphoreCreateMutex();
  displayQueue   = xQueueCreate(1, sizeof(DisplayData));

  randomSeed(esp_random());  // seed RNG cho auto-random dev mode

  if (dataMutex != NULL && tftMutex != NULL && mqttStateMutex != NULL
      && devModeMutex != NULL && displayQueue != NULL) {
    Serial.println("[OK] FreeRTOS objects created");

    // Khởi tạo bộ luật fuzzy logic (243 rules)
    initRuleBase();

    xTaskCreatePinnedToCore(
      sensorTask, "SensorTask",
      SENSOR_TASK_STACK_SIZE, NULL,
      SENSOR_TASK_PRIORITY, NULL, 0
    );

    xTaskCreatePinnedToCore(
      pumpTask, "PumpTask",
      PUMP_TASK_STACK_SIZE, NULL,
      PUMP_TASK_PRIORITY, NULL, 0
    );

    xTaskCreatePinnedToCore(
      displayTask, "DisplayTask",
      DISPLAY_TASK_STACK_SIZE, NULL,
      DISPLAY_TASK_PRIORITY, NULL, 1
    );

    xTaskCreatePinnedToCore(
      serialTask, "SerialTask",
      SERIAL_TASK_STACK_SIZE, NULL,
      SERIAL_TASK_PRIORITY, NULL, 0
    );

    // MQTT task chạy trên Core 1 để không block sensor
    xTaskCreatePinnedToCore(
      mqttTask, "MqttTask",
      MQTT_TASK_STACK_SIZE, NULL,
      MQTT_TASK_PRIORITY, NULL, 1
    );

    // Button task chạy trên Core 1
    xTaskCreatePinnedToCore(
      buttonTask, "ButtonTask",
      BUTTON_TASK_STACK_SIZE, NULL,
      BUTTON_TASK_PRIORITY, &btnTaskHandle, 1
    );

    // BOOT button task (GPIO 0) - long press 3s để reconnect
    xTaskCreatePinnedToCore(
      bootButtonTask, "BootBtnTask",
      BOOT_BTN_TASK_STACK_SIZE, NULL,
      BOOT_BTN_TASK_PRIORITY, NULL, 1
    );

    // Attach interrupt SAU khi task đã tạo (btnTaskHandle có giá trị)
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, CHANGE);
    
    Serial.println("[OK] All 7 tasks created");
  } else {
    Serial.println("[ERROR] Failed to create FreeRTOS objects");
  }

  vTaskDelete(NULL);
}

// =============================================================
// LOOP (không dùng - FreeRTOS tasks)
// =============================================================
void loop() {
  vTaskDelay(portMAX_DELAY);
}