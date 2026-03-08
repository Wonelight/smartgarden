package com.example.smart_garden.mqtt;

import com.example.smart_garden.mqtt.payload.MqttAckPayload;
import com.example.smart_garden.mqtt.payload.MqttCommandPayload;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Gửi command tới MCU qua MQTT với ACK mechanism: timeout, retry, xử lý
 * duplicate (QoS 1 có thể gửi 2 lần).
 * cleanSession=false + ClientID cố định đã cấu hình ở MqttConfig.
 */
@Slf4j
@Service
public class MqttCommandSender {

    private final MqttProperties props;
    private final ObjectMapper objectMapper;
    private final MessageChannel mqttOutboundChannel;

    /** cmd_id -> PendingCommand. Complete future khi nhận ACK hoặc timeout. */
    private final Map<String, PendingCommand> pending = new ConcurrentHashMap<>();

    /**
     * Đã xử lý ack cho cmd_id (để bỏ qua duplicate). Expiry theo duplicateWindowMs.
     */
    private final Map<String, Long> ackedCmdIds = new ConcurrentHashMap<>();
    private static final long CLEANUP_INTERVAL_MS = 60_000;
    private volatile long lastCleanup = System.currentTimeMillis();

    public MqttCommandSender(MqttProperties props,
            ObjectMapper objectMapper,
            @Qualifier("mqttOutboundChannel") MessageChannel mqttOutboundChannel) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.mqttOutboundChannel = mqttOutboundChannel;
    }

    /**
     * Gửi command và chờ ACK (với timeout + retry). Retain=false, QoS 1.
     *
     * @param deviceCode device code (topic)
     * @param cmd        PUMP_ON, PUMP_OFF, AUTO, SET_SETPOINT, IRRIGATE
     * @param setpoint   optional (cho SET_SETPOINT)
     * @return true nếu nhận ACK ok trong thời gian quy định (sau retry), false nếu
     *         timeout/fail
     */
    public boolean sendAndWaitAck(String deviceCode, String cmd, Integer setpoint) {
        return sendAndWaitAck(deviceCode, cmd, setpoint, null);
    }

    /**
     * Gửi command và chờ ACK, hỗ trợ IRRIGATE command với duration.
     *
     * @param deviceCode device code (topic)
     * @param cmd        PUMP_ON, PUMP_OFF, AUTO, SET_SETPOINT, IRRIGATE
     * @param setpoint   optional (cho SET_SETPOINT)
     * @param duration   optional duration in seconds (cho IRRIGATE)
     * @return true nếu nhận ACK ok
     */
    public boolean sendAndWaitAck(String deviceCode, String cmd, Integer setpoint, Integer duration) {
        String cmdId = UUID.randomUUID().toString();

        MqttCommandPayload.Params params = null;
        if (setpoint != null || duration != null) {
            params = new MqttCommandPayload.Params();
            if (setpoint != null) params.setSetpoint(setpoint);
            if (duration != null) params.setDuration(duration);
        }

        MqttCommandPayload payload = MqttCommandPayload.builder()
                .cmdId(cmdId)
                .cmd(cmd)
                .params(params)
                .build();

        int tries = 0;
        int maxTries = 1 + Math.max(0, props.getCommandRetryCount());
        long timeoutMs = props.getCommandAckTimeoutMs();

        for (int i = 0; i < maxTries; i++) {
            tries++;
            CompletableFuture<Boolean> future = new CompletableFuture<>();
            pending.put(cmdId, new PendingCommand(future, Instant.now().toEpochMilli()));

            if (!publishCommand(deviceCode, payload)) {
                pending.remove(cmdId);
                return false;
            }

            try {
                Boolean result = future.get(timeoutMs, TimeUnit.MILLISECONDS);
                pending.remove(cmdId);
                return Boolean.TRUE.equals(result);
            } catch (TimeoutException e) {
                log.warn("Command {} ack timeout (try {}/{}), deviceCode={}", cmdId, tries, maxTries, deviceCode);
                pending.remove(cmdId);
                if (i == maxTries - 1)
                    return false;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                pending.remove(cmdId);
                return false;
            } catch (ExecutionException e) {
                pending.remove(cmdId);
                return false;
            }
        }
        return false;
    }

    /**
     * Gọi từ MqttInboundHandler khi nhận message topic .../cmd/ack.
     * Xử lý duplicate: nếu cmd_id đã xử lý trong duplicateWindowMs thì bỏ qua.
     */
    public void onAck(String deviceCode, MqttAckPayload ack) {
        if (ack == null || ack.getCmdId() == null)
            return;

        cleanupAckedIfNeeded();

        long now = System.currentTimeMillis();
        if (ackedCmdIds.putIfAbsent(ack.getCmdId(), now) != null) {
            log.debug("Duplicate ack ignored for cmd_id={}", ack.getCmdId());
            return;
        }

        PendingCommand pendingCmd = pending.remove(ack.getCmdId());
        if (pendingCmd != null) {
            // "ok" = executed, "skipped" = ESP32 safety gate blocked (still a valid ACK, no MQTT failure)
            boolean ok = "ok".equalsIgnoreCase(ack.getStatus())
                      || "skipped".equalsIgnoreCase(ack.getStatus());
            pendingCmd.future.complete(ok);
        }
    }

    private boolean publishCommand(String deviceCode, MqttCommandPayload payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            String topic = MqttTopics.cmd(deviceCode);
            Message<String> message = MessageBuilder.withPayload(json)
                    .setHeader(MqttHeaders.TOPIC, topic)
                    .setHeader(MqttHeaders.QOS, 1)
                    .setHeader(MqttHeaders.RETAINED, false)
                    .build();
            mqttOutboundChannel.send(message);
            return true;
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize command payload", e);
            return false;
        }
    }

    /**
     * Publish registration status to device (retained).
     * Called when device is connected/disconnected/deleted from web app.
     *
     * @param deviceCode device code
     * @param action     "DEVICE_REMOVED" or "DEVICE_REGISTERED"
     */
    public void publishRegistrationStatus(String deviceCode, String action) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "action", action,
                    "ts", Instant.now().toEpochMilli()));
            String topic = MqttTopics.registration(deviceCode);
            Message<String> message = MessageBuilder.withPayload(json)
                    .setHeader(MqttHeaders.TOPIC, topic)
                    .setHeader(MqttHeaders.QOS, 1)
                    .setHeader(MqttHeaders.RETAINED, true)
                    .build();
            mqttOutboundChannel.send(message);
            log.info("Published registration status: {} -> {}", deviceCode, action);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize registration payload", e);
        }
    }

    private void cleanupAckedIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup < CLEANUP_INTERVAL_MS)
            return;
        lastCleanup = now;
        long expire = now - props.getDuplicateWindowMs();
        ackedCmdIds.entrySet().removeIf(e -> e.getValue() < expire);
    }

    private record PendingCommand(CompletableFuture<Boolean> future, long createdAt) {
    }
}
