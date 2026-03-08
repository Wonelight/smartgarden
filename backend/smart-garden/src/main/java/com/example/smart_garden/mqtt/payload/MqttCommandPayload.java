package com.example.smart_garden.mqtt.payload;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload command Backend → MCU. Luôn có cmd_id để tracking và ACK.
 * cmd: PUMP_ON | PUMP_OFF | AUTO | SET_SETPOINT
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MqttCommandPayload {

    /** Unique command id (UUID) để MCU echo lại trong ACK. */
    private String cmdId;

    /** PUMP_ON, PUMP_OFF, AUTO, SET_SETPOINT. */
    private String cmd;

    /** Optional params, e.g. setpoint 0-100. */
    private Params params;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Params {
        private Integer setpoint;
        /** Duration in seconds for IRRIGATE command (AI-predicted irrigation). */
        private Integer duration;

        /** Convenience constructor for setpoint-only commands. */
        public Params(Integer setpoint) {
            this.setpoint = setpoint;
            this.duration = null;
        }
    }
}
