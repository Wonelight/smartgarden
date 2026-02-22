package com.example.smart_garden.service;

/**
 * DCDecisionService — Hybrid Decision Making.
 *
 * Combines:
 * 1. Calculated DC (from AgroPhysics) — theoretical soil depletion
 * 2. Real-time Soil Moisture (from Sensor) — current sensor reading
 * 3. Python Random Forest Model — ML prediction
 *
 * To generate a final irrigation command.
 */
public interface DCDecisionService {

    /**
     * Make a hybrid irrigation decision for a device.
     * Combines agro-physics DC with real-time sensor data and ML model.
     *
     * @param deviceId The device to evaluate
     * @return Decision result containing recommendation and predicted irrigation
     *         amount
     */
    DCDecisionResult makeDecision(Long deviceId);

    /**
     * Decision result record.
     */
    record DCDecisionResult(
            boolean shouldIrrigate,
            double recommendedAmount,
            double dcValue,
            double sensorMoisture,
            String mlPrediction,
            String recommendation) {
    }
}
