package com.example.smart_garden.service;

import com.example.smart_garden.dto.ai.request.AiPredictRequest;
import com.example.smart_garden.dto.ai.request.AiTrainRequest;
import com.example.smart_garden.dto.ai.response.AiPredictResponse;
import com.example.smart_garden.dto.ai.response.AiTrainResponse;
import com.example.smart_garden.dto.monitoring.response.MlPredictionDetailResponse;

/**
 * Service interface cho AI prediction operations.
 * Hỗ trợ nhiều model: ANFIS, RandomForest, FAO, v.v.
 */
public interface AiPredictionService {

    /**
     * Trigger AI prediction cho device dựa trên sensor data.
     */
    AiPredictResponse predict(AiPredictRequest request);

    /**
     * Trigger AI model training cho device dựa trên historical data.
     */
    AiTrainResponse train(AiTrainRequest request);

    /**
     * Lấy kết quả AI prediction mới nhất theo device.
     */
    MlPredictionDetailResponse getLatestResult(Long deviceId);
}
