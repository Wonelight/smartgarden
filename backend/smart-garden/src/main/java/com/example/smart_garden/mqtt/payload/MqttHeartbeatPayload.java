package com.example.smart_garden.mqtt.payload;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Application-level heartbeat. Backend dùng để cập nhật lastOnline.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MqttHeartbeatPayload {

    /** Unix ms */
    private Long ts;
}
