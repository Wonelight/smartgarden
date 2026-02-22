package com.example.smart_garden.mqtt;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Cấu hình MQTT: broker, client (cleanSession=false, clientId cố định), TLS, command timeout/retry.
 */
@Data
@Component
@ConfigurationProperties(prefix = "mqtt")
public class MqttProperties {

    /** Broker URL (tcp://host:1883 hoặc ssl://host:8883). */
    private String brokerUrl = "tcp://localhost:1883";

    /** Client ID cố định cho backend (persistent session). */
    private String clientId = "smart-garden-backend";

    private String username;
    private String password;

    /** cleanSession = false để nhận offline messages khi reconnect. */
    private boolean cleanSession = false;

    /** Connection timeout (ms). */
    private int connectionTimeout = 30;

    /** Keep alive (seconds). */
    private int keepAliveInterval = 60;

    /** Automatic reconnect. */
    private boolean automaticReconnect = true;

    /** TLS: use SSL (ssl://). */
    private boolean ssl = false;

    /** Command ACK timeout (ms). */
    private long commandAckTimeoutMs = 15_000;

    /** Số lần retry gửi command khi không nhận ACK. */
    private int commandRetryCount = 2;

    /** Application heartbeat: coi device offline nếu không nhận heartbeat trong (ms). */
    private long heartbeatTimeoutMs = 120_000;

    /** Duplicate window: bỏ qua ack trùng cmd_id trong khoảng thời gian (ms). */
    private long duplicateWindowMs = 60_000;
}
