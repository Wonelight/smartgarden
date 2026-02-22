package com.example.smart_garden.mqtt;

import com.example.smart_garden.entity.enums.DeviceStatus;
import com.example.smart_garden.mqtt.payload.*;
import com.example.smart_garden.service.DeviceService;
import com.example.smart_garden.service.SensorDataService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

/**
 * Xử lý message MQTT từ MCU: sensor, status, heartbeat, lwt, cmd/ack.
 * Topic được phân biệt qua MqttTopics.deviceCodeFromTopic(receivedTopic).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MqttInboundHandler {

    private final SensorDataService sensorDataService;
    private final DeviceService deviceService;
    private final MqttCommandSender mqttCommandSender;
    private final ObjectMapper objectMapper;

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
        } catch (JsonProcessingException e) {
            log.warn("Invalid sensor JSON from deviceCode={}: {}", deviceCode, e.getMessage());
        }
    }

    private void handleStatus(String deviceCode, String body) {
        deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.ONLINE);
        // Có thể parse MqttStatusPayload để lưu thêm (manualMode, pumpState, setPoint) nếu cần
    }

    private void handleHeartbeat(String deviceCode, String body) {
        deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.ONLINE);
    }

    private void handleLwt(String deviceCode, String body) {
        deviceService.updateStatusByDeviceCode(deviceCode, DeviceStatus.OFFLINE);
    }

    private void handleCmdAck(String deviceCode, String body) {
        try {
            MqttAckPayload payload = objectMapper.readValue(body, MqttAckPayload.class);
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
