#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include "Adafruit_SHT4x.h"
#include <BH1750.h>
#include <FreeRTOS.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
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
#define RELAY_PIN 4

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
// TASK CONFIG
// =============================================================
#define SENSOR_TASK_STACK_SIZE    8192
#define PUMP_TASK_STACK_SIZE      4096
#define DISPLAY_TASK_STACK_SIZE   8192
#define SERIAL_TASK_STACK_SIZE    4096
#define MQTT_TASK_STACK_SIZE      8192

#define SENSOR_TASK_PRIORITY      2
#define PUMP_TASK_PRIORITY        1
#define DISPLAY_TASK_PRIORITY     1
#define SERIAL_TASK_PRIORITY      1
#define MQTT_TASK_PRIORITY        2

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
  unsigned long timestamp;
} SensorData;

typedef struct {
  float temp;
  float hum;
  float lux;
  int soil1;
  int soil2;
  int rain;
  bool pump;
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
  bool pendingStatusPublish;   // Flag: cần publish status khi thay đổi
} MqttState;

MqttState mqttState = {false, PUMP_OFF_THRESHOLD, false};
SemaphoreHandle_t mqttStateMutex = NULL;

// =============================================================
// OBJECTS
// =============================================================
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
Adafruit_SHT4x  sht4;
BH1750          lightMeter;
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
  topicStatus    = prefix + "/status";
  topicSensor    = prefix + "/sensor";
  topicHeartbeat = prefix + "/heartbeat";
  topicLwt       = prefix + "/lwt";
  topicCmd       = prefix + "/cmd";
  topicCmdAck    = prefix + "/cmd/ack";
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

    tft.fillRect(0, 0, 160, 18, ST77XX_BLUE);
    tft.setTextColor(ST77XX_WHITE); 
    tft.setTextSize(1);
    tft.setCursor(22, 5); 
    tft.print("  GARDEN MONITOR  ");

    tft.setTextColor(ST77XX_YELLOW);
    tft.setCursor(5,  22); 
    tft.print("Temp:");
    tft.setCursor(88, 22); 
    tft.print("Humid:");
    tft.drawFastHLine(0, 53, 160, ST77XX_MAGENTA);
    tft.setCursor(5,  60); 
    tft.print("Light:");
    tft.setCursor(88, 60); 
    tft.print("Rain:");
    tft.drawFastHLine(0, 82, 160, ST77XX_MAGENTA);
    tft.setCursor(5,  88); 
    tft.print("Shallow:");
    tft.setCursor(88, 88); 
    tft.print("Deep:");
    tft.drawFastHLine(0, 108, 160, ST77XX_MAGENTA);
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 116); 
    tft.print("PUMP:");
    
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

void updateScreen(float t, float h, float l, int s1, int s2, int rain, bool pump) {
  char buf[16];

  snprintf(buf, sizeof(buf), "%.1f C", t);
  fillAndPrint(37, 22, 46, 10, ST77XX_ORANGE, buf);

  snprintf(buf, sizeof(buf), "%.0f%%", h);
  fillAndPrint(122, 22, 38, 10, ST77XX_CYAN, buf);

  if (l > 9999) snprintf(buf, sizeof(buf), ">9999lx");
  else          snprintf(buf, sizeof(buf), "%dlx", (int)l);
  fillAndPrint(42, 60, 42, 8, ST77XX_WHITE, buf);

  fillAndPrint(118, 60, 42, 8,
    rain > 30 ? ST77XX_RED : ST77XX_GREEN,
    rain > 30 ? "YES" : "NO ");

  snprintf(buf, sizeof(buf), "%d%%", s1);
  fillAndPrint(56, 88, 28, 8, soilColor(s1), buf);

  snprintf(buf, sizeof(buf), "%d%%", s2);
  fillAndPrint(115, 88, 28, 8, soilColor(s2), buf);

  fillAndPrint(40, 112, 120, 12,
    pump ? ST77XX_RED : ST77XX_GREEN,
    pump ? ">>> RUNNING <<<" : "   STANDBY   ");
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
  doc["ambientLight"]    = localData.lux;
  doc["pumpState"]       = localData.pump_state;
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
  doc["online"]     = true;
  doc["manualMode"] = localManualMode;
  doc["pumpState"]  = localData.pump_state;
  doc["setPoint"]   = localSetPoint;
  doc["ts"]         = (long long)getEpochMs();

  char buffer[256];
  serializeJson(doc, buffer, sizeof(buffer));

  // Status is retained
  mqttClient.publish(topicStatus.c_str(), buffer, true);
  Serial.println("[MQTT] Status published (retained)");
}

void publishCmdAck(const char* cmdId, const char* status, const char* message) {
  JsonDocument doc;
  doc["cmdId"]   = cmdId;
  doc["status"]  = status;
  if (message != NULL && strlen(message) > 0) {
    doc["message"] = message;
  }

  char buffer[256];
  serializeJson(doc, buffer, sizeof(buffer));

  mqttClient.publish(topicCmdAck.c_str(), buffer);
  Serial.printf("[MQTT] ACK sent: cmdId=%s status=%s\n", cmdId, status);
}

// =============================================================
// MQTT: COMMAND HANDLER (callback)
// =============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Chỉ xử lý topic cmd
  if (String(topic) != topicCmd) return;

  // Parse payload
  char json[MQTT_BUFFER_SIZE];
  size_t copyLen = min((unsigned int)(MQTT_BUFFER_SIZE - 1), length);
  memcpy(json, payload, copyLen);
  json[copyLen] = '\0';

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
  const char* ackMsg = "";

  if (strcmp(cmd, "PUMP_ON") == 0) {
    // Manual mode: bật bơm
    digitalWrite(RELAY_PIN, HIGH);
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.pump_state = true;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = true;
      mqttState.pendingStatusPublish = true;
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Pump turned ON (manual)";
    Serial.println("[CMD] PUMP_ON executed");

  } else if (strcmp(cmd, "PUMP_OFF") == 0) {
    // Manual mode: tắt bơm
    digitalWrite(RELAY_PIN, LOW);
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      sharedData.pump_state = false;
      xSemaphoreGive(dataMutex);
    }
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = true;
      mqttState.pendingStatusPublish = true;
      xSemaphoreGive(mqttStateMutex);
    }
    ackMsg = "Pump turned OFF (manual)";
    Serial.println("[CMD] PUMP_OFF executed");

  } else if (strcmp(cmd, "AUTO") == 0) {
    // Trở lại auto mode
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      mqttState.manualMode = false;
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
  
  while(1) {
    sensors_event_t hum, tmp;
    
    if (sht4.getEvent(&hum, &tmp)) {
      float lux = lightMeter.readLightLevel();
      if (lux < 0) lux = 0;
      
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

      DisplayData displayData;
      displayData.temp = tmp.temperature;
      displayData.hum = hum.relative_humidity;
      displayData.lux = lux;
      displayData.soil1 = p1;
      displayData.soil2 = p2;
      displayData.rain = rainPct;
      displayData.pump = sharedData.pump_state;
      
      xQueueOverwrite(displayQueue, &displayData);
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(2000));
  }
}

void pumpTask(void *pvParameters) {
  bool localPumpState = false;
  unsigned long lastPumpTime = 0;
  const unsigned long pumpMinInterval = 60000;
    
  while(1) {
    int soil1_percent = 0;
    unsigned long currentTime = millis();
    bool localManualMode = false;
    int  localSetPoint = PUMP_OFF_THRESHOLD;

    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      soil1_percent = sharedData.soil1_percent;
      xSemaphoreGive(dataMutex);
    }

    // Đọc manual mode & setPoint
    if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      localManualMode = mqttState.manualMode;
      localSetPoint   = mqttState.setPoint;
      xSemaphoreGive(mqttStateMutex);
    }

    // Chỉ điều khiển pump khi AUTO mode
    if (!localManualMode) {
      int pumpOnThreshold  = max(0, localSetPoint - 10);  // setPoint - 10
      int pumpOffThreshold = localSetPoint;

      if (!localPumpState && soil1_percent < pumpOnThreshold) {
        if (currentTime - lastPumpTime > pumpMinInterval) {
          digitalWrite(RELAY_PIN, HIGH);
          localPumpState = true;
          lastPumpTime = currentTime;
        }
      }
      else if (localPumpState && soil1_percent >= pumpOffThreshold) {
        digitalWrite(RELAY_PIN, LOW);
        localPumpState = false;
      }

      // Đồng bộ state
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        sharedData.pump_state = localPumpState;
        xSemaphoreGive(dataMutex);
      }
    } else {
      // Manual mode: đọc lại pump state từ sharedData (được set bởi command handler)
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        localPumpState = sharedData.pump_state;
        xSemaphoreGive(dataMutex);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(500));
  }
}

void displayTask(void *pvParameters) {
  DisplayData displayData;
  
  vTaskDelay(pdMS_TO_TICKS(1000));
  drawStaticUI();
  
  while(1) {
    if (xQueueReceive(displayQueue, &displayData, portMAX_DELAY) == pdTRUE) {
      updateScreen(displayData.temp, displayData.hum, displayData.lux,
                   displayData.soil1, displayData.soil2, 
                   displayData.rain, displayData.pump);
    }
    taskYIELD();
  }
}

void serialTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  SensorData localData;
  
  while(1) {
    memset(&localData, 0, sizeof(SensorData));
    
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      memcpy(&localData, &sharedData, sizeof(SensorData));
      xSemaphoreGive(dataMutex);
    }

    if (localData.timestamp > 0) {
      Serial.printf("Temp:%.1fC Hum:%.0f%% Lux:%.0f Rain:%d%% Soil1:%d%% Soil2:%d%% Pump:%s\n",
        localData.temperature, localData.humidity,
        localData.lux, localData.rain_percent, 
        localData.soil1_percent, localData.soil2_percent,
        localData.pump_state ? "ON" : "OFF"
      );
    }

    vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(3000));
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

      // --- Publish status nếu có thay đổi ---
      bool needStatusPublish = false;
      if (xSemaphoreTake(mqttStateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        needStatusPublish = mqttState.pendingStatusPublish;
        xSemaphoreGive(mqttStateMutex);
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

  WiFiManager wm;

  // Custom parameters cho MQTT
  WiFiManagerParameter custom_mqtt_server("server", "MQTT Server IP", mqtt_server, 40);
  WiFiManagerParameter custom_mqtt_port("port", "MQTT Port", mqtt_port, 6);

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
  
  if (retry < 10) {
    Serial.printf("\n[NTP] Time: %04d-%02d-%02d %02d:%02d:%02d\n",
      timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
      timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  } else {
    Serial.println("\n[NTP] Sync failed (will retry later)");
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

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
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
    Serial.println("[ERROR] BH1750");
  } else {
    Serial.println("[OK] BH1750");
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

  // ---- WiFi + MQTT ----
  initWiFi();
  initNTP();
  initMQTT();

  // ---- FreeRTOS objects ----
  dataMutex      = xSemaphoreCreateMutex();
  tftMutex       = xSemaphoreCreateMutex();
  mqttStateMutex = xSemaphoreCreateMutex();
  displayQueue   = xQueueCreate(1, sizeof(DisplayData));

  if (dataMutex != NULL && tftMutex != NULL && mqttStateMutex != NULL && displayQueue != NULL) {
    Serial.println("[OK] FreeRTOS objects created");
    
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
    
    Serial.println("[OK] All 5 tasks created");
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