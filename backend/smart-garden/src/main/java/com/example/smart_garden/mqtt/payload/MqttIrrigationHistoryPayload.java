package com.example.smart_garden.mqtt.payload;

import lombok.Data;

@Data
public class MqttIrrigationHistoryPayload {
    private Long startTime;
    private Long endTime;
    private Integer duration;
    private Float waterVolume;
    private String mode;
    private Float soilMoistureBefore;
    private Float soilMoistureAfter;
}
