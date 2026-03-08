package com.example.smart_garden.mqtt;

/**
 * Topic naming convention cho MQTT Backend ↔ ESP32.
 * <p>
 * Format: {@code smart_garden/devices/{deviceCode}/{type}}
 * <ul>
 * <li>deviceCode: mã thiết bị (unique, dùng làm MQTT ClientID trên MCU)</li>
 * <li>type: status | sensor | heartbeat | lwt | cmd | cmd/ack</li>
 * </ul>
 * <p>
 * QoS & Retain:
 * <ul>
 * <li>status, lwt: retain=true, QoS 1 (last known state)</li>
 * <li>sensor, heartbeat, cmd, cmd/ack: retain=false, QoS 1 (cmd/ack), QoS 0 or
 * 1 (sensor/heartbeat)</li>
 * </ul>
 */
public final class MqttTopics {

    private static final String PREFIX = "smart_garden/devices";

    /**
     * Device status (online/offline/error, manualMode, pumpState, setPoint).
     * Retain=true, QoS 1.
     */
    public static String status(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/status";
    }

    /** Telemetry từ MCU. Retain=false, QoS 1. */
    public static String sensor(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/sensor";
    }

    /** Application-level heartbeat. Retain=false, QoS 0. */
    public static String heartbeat(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/heartbeat";
    }

    /** Last Will Testament. Payload "offline". Retain=true, QoS 1. */
    public static String lwt(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/lwt";
    }

    /** Command từ Backend → MCU. Retain=false, QoS 1. */
    public static String cmd(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/cmd";
    }

    /** History từ MCU → Backend. Retain=false, QoS 1. */
    public static String history(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/history";
    }

    /** ACK từ MCU → Backend. Retain=false, QoS 1. */
    public static String cmdAck(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/cmd/ack";
    }

    /** Registration từ Backend → MCU. Retain=true, QoS 1. */
    public static String registration(String deviceCode) {
        return PREFIX + "/" + sanitize(deviceCode) + "/registration";
    }

    /** Subscribe tất cả device: status, sensor, heartbeat, lwt, cmd/ack. */
    public static final String SUB_STATUS = PREFIX + "/+/status";
    public static final String SUB_SENSOR = PREFIX + "/+/sensor";
    public static final String SUB_HEARTBEAT = PREFIX + "/+/heartbeat";
    public static final String SUB_LWT = PREFIX + "/+/lwt";
    public static final String SUB_CMD_ACK = PREFIX + "/+/cmd/ack";
    public static final String SUB_HISTORY = PREFIX + "/+/history";

    /**
     * Extract deviceCode từ topic (e.g. smart_garden/devices/ESP32_ABC/status →
     * ESP32_ABC).
     */
    public static String deviceCodeFromTopic(String topic) {
        if (topic == null || !topic.startsWith(PREFIX + "/"))
            return null;
        String rest = topic.substring(PREFIX.length() + 1);
        int slash = rest.indexOf('/');
        return slash > 0 ? rest.substring(0, slash) : rest;
    }

    private static String sanitize(String deviceCode) {
        return deviceCode == null ? "" : deviceCode.replaceAll("[^a-zA-Z0-9_-]", "_");
    }

    private MqttTopics() {
    }
}
