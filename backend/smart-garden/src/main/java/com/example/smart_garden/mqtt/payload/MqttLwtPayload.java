package com.example.smart_garden.mqtt.payload;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LWT (Last Will Testament) payload. Broker gửi khi device mất kết nối.
 * Payload thường là "offline" (string). Backend set Device.status = OFFLINE.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MqttLwtPayload {

    private String status;

    public static MqttLwtPayload offline() {
        return new MqttLwtPayload("offline");
    }
}
