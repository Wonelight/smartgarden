package com.example.smart_garden.mqtt.payload;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Payload sensor MCU → Backend. Map với SensorData entity (device nhận diện qua
 * topic deviceCode).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MqttSensorPayload {

    private Float soilMoisture; // soil1 %
    private Float soilMoisture2; // soil2 %
    private Float temperature;
    private Float humidity;
    private Float lightIntensity; // lux
    private Boolean rainDetected;
    private Float rainIntensity;
    private Float ambientLight;
    private Boolean pumpState;
    private Boolean lightState;
    /** Unix ms */
    private Long ts;

    public Instant timestampAsInstant() {
        return ts != null ? Instant.ofEpochMilli(ts) : null;
    }
}
