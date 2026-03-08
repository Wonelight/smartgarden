package com.example.smart_garden.mqtt;

import com.example.smart_garden.entity.enums.DeviceStatus;
import com.example.smart_garden.mqtt.payload.*;
import com.example.smart_garden.service.DeviceService;
import com.example.smart_garden.service.SensorDataService;
import com.example.smart_garden.websocket.WebSocketBroadcaster;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

/**
 * Xử lý message MQTT từ MCU: sensor, status, heartbeat, lwt, cmd/ack.
 * Khi nhận sensor/status → broadcast qua WebSocket cho Frontend real-time.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MqttInboundHandler {

    private final SensorDataService sensorDataService;
    private final DeviceService deviceService;
    private final com.example.smart_garden.service.IrrigationService irrigationService;
    private final MqttCommandSender mqttCommandSender;
    private final ObjectMapper objectMapper;
    private final WebSocketBroadcaster webSocketBroadcaster;

    public void handle(Message<?> message) {
        String topic = getHeader(message, MqttHeaders.RECEIVED_TOPIC);
        if (topic == null) {
            log.warn("MQTT message without topic");
            return;
        }
        String deviceCode = MqttTopics.deviceCodeFromTopic(topic);
        if (deviceCode == null || deviceCode.isBlank()) {
            log.warn("MQTT message topic could not parse deviceCode: {}", topic);
            return;
        }

        // Bỏ qua retained messages — đây là bản ghi lịch sử broker replay lại khi
        // backend reconnect (cleanSession=false). Chỉ xử lý live messages thực sự.
        // Nếu không lọc: mỗi lần backend reconnect sẽ nhận /status (ONLINE retained)
        // và /lwt (OFFLINE retained) cùng lúc → tạo cặp log spam vô nghĩa.
        Boolean retained = (Boolean) message.getHeaders().get(MqttHeaders.RECEIVED_RETAINED);
        if (Boolean.TRUE.equals(retained)) {
            log.debug("Skipping retained MQTT message: topic={}, device={}", topic, deviceCode);
            return;
        }

        Object payload = message.getPayload();
        String body = payload instanceof String ? (String) payload : (payload != null ? payload.toString() : null);
        if (body == null || body.isBlank()) {
            return;
        }

        try {
            if (topic.endsWith("/sensor")) {
                handleSensor(deviceCode, body);
            } else if (topic.endsWith("/status")) {
                handleStatus(deviceCode, body);
            } else if (topic.endsWith("/heartbeat")) {
                handleHeartbeat(deviceCode, body);
            } else if (topic.endsWith("/lwt")) {
                handleLwt(deviceCode, body);
            } else if (topic.endsWith("/history")) {
                handleHistory(deviceCode, body);
            } else if (topic.endsWith("/cmd/ack")) {
                handleCmdAck(deviceCode, body);
            }
        } catch (Exception e) {
            log.error("Error handling MQTT message topic={} deviceCode={}", topic, deviceCode, e);
        }
    }

    private void handleSensor(String deviceCode, String body) {
        try {
            MqttSensorPayload payload = objectMapper.readValue(body, MqttSensorPayload.class);
            sensorDataService.ingestFromMqtt(deviceCode, payload);

            // ✅ Broadcast sensor data qua WebSocket cho Frontend
            webSocketBroadcaster.broadcastSensorData(deviceCode, payload);
        } catch (JsonProcessingException e) {
            log.warn("Invalid sensor JSON from deviceCode={}: {}", deviceCode, e.getMessage());
        }
    }

    private void handleStatus(String deviceCode, String body) {
        try {
            MqttStatusPayload payload = objectMapper.readValue(body, MqttStatusPayload.class);
            // ✅ Update status & fallback location
            deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.ONLINE, payload);

            // ✅ Broadcast status detail qua WebSocket
            webSocketBroadcaster.broadcastDeviceStatusDetail(deviceCode, payload);
        } catch (JsonProcessingException e) {
            // Fallback: chỉ update online status
            deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.ONLINE, null);
            webSocketBroadcaster.broadcastDeviceStatus(deviceCode, "ONLINE");
        }
    }

    private void handleHeartbeat(String deviceCode, String body) {
        deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.ONLINE, null);
    }

    private void handleLwt(String deviceCode, String body) {
        deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.OFFLINE, null);

        // ✅ Broadcast offline status qua WebSocket
        webSocketBroadcaster.broadcastDeviceStatus(deviceCode, "OFFLINE");
    }

    private void handleHistory(String deviceCode, String body) {
        try {
            com.example.smart_garden.mqtt.payload.MqttIrrigationHistoryPayload payload = objectMapper.readValue(body,
                    com.example.smart_garden.mqtt.payload.MqttIrrigationHistoryPayload.class);
            irrigationService.ingestHistoryFromMqtt(deviceCode, payload);
        } catch (JsonProcessingException e) {
            log.warn("Invalid history JSON from deviceCode={}: {}", deviceCode, e.getMessage());
        }
    }

    private void handleCmdAck(String deviceCode, String body) {
        log.info("📌 [MqttInboundHandler] Received ACK from {}: {}", deviceCode, body);
        try {
            MqttAckPayload payload = objectMapper.readValue(body, MqttAckPayload.class);
            log.info("📌 [MqttInboundHandler] Parsed ACK: cmdId={}, status={}", payload.getCmdId(),
                    payload.getStatus());
            mqttCommandSender.onAck(deviceCode, payload);
        } catch (JsonProcessingException e) {
            log.warn("Invalid cmd/ack JSON from deviceCode={}: {}", deviceCode, e.getMessage());
        }
    }

    private static String getHeader(Message<?> message, String key) {
        Object v = message.getHeaders().get(key);
        return v != null ? v.toString() : null;
    }
}
