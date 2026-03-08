package com.example.smart_garden.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Broadcast dữ liệu real-time từ MQTT → WebSocket (STOMP) cho Frontend.
 * <p>
 * Topics:
 * <ul>
 * <li>/topic/devices/{deviceCode}/sensor – dữ liệu cảm biến mới</li>
 * <li>/topic/devices/{deviceCode}/status – trạng thái thiết bị thay đổi</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcast dữ liệu sensor mới cho tất cả client đang subscribe device này.
     */
    public void broadcastSensorData(String deviceCode, Object sensorPayload) {
        String destination = "/topic/devices/" + deviceCode + "/sensor";
        messagingTemplate.convertAndSend(destination, sensorPayload);
        log.debug("WS broadcast sensor → {} ", destination);
    }

    /**
     * Broadcast thay đổi trạng thái thiết bị (online/offline/error).
     */
    public void broadcastDeviceStatus(String deviceCode, String status) {
        String destination = "/topic/devices/" + deviceCode + "/status";
        messagingTemplate.convertAndSend(destination, Map.of(
                "deviceCode", deviceCode,
                "status", status,
                "timestamp", System.currentTimeMillis()));
        log.debug("WS broadcast status → {} = {}", destination, status);
    }

    /**
     * Broadcast trạng thái chi tiết (manualMode, pumpState, setPoint...).
     */
    public void broadcastDeviceStatusDetail(String deviceCode, Object statusPayload) {
        String destination = "/topic/devices/" + deviceCode + "/status";
        messagingTemplate.convertAndSend(destination, statusPayload);
        log.debug("WS broadcast status detail → {}", destination);
    }
}
