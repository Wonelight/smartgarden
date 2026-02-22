package com.example.smart_garden.mqtt.payload;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload ACK MCU → Backend. Echo cmd_id để match command.
 * Xử lý duplicate: QoS 1 có thể gửi 2 lần → backend bỏ qua ack trùng cmd_id trong duplicate window.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MqttAckPayload {

    private String cmdId;
    /** ok | error */
    private String status;
    private String message;
}
