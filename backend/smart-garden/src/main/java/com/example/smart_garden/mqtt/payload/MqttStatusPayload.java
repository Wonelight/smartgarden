package com.example.smart_garden.mqtt.payload;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload status MCU → Backend (retain=true). Last known state.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MqttStatusPayload {

    private Boolean online;
    private Boolean manualMode;
    private Boolean pumpState;
    private Integer setPoint;
    private Long ts;
}
