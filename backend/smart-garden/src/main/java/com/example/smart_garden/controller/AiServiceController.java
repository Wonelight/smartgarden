package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.ai.request.AiPredictRequest;
import com.example.smart_garden.dto.ai.request.AiTrainRequest;
import com.example.smart_garden.dto.ai.response.AiPredictResponse;
import com.example.smart_garden.dto.ai.response.AiTrainResponse;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.monitoring.response.MlPredictionDetailResponse;
import com.example.smart_garden.service.AiPredictionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * API endpoints cho AI Service operations.
 * Hỗ trợ predict, train, và lấy kết quả cho tất cả models.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class AiServiceController {

    private final AiPredictionService aiPredictionService;

    /**
     * Trigger AI prediction.
     * Input: device_id, sensor_data_id
     * Output: predicted_duration, confidence, ai_output
     */
    @PostMapping(ApiPaths.SEG_AI_PREDICT)
    public ApiResponse<AiPredictResponse> predict(
            @Valid @RequestBody AiPredictRequest request) {
        return ApiResponse.ok(aiPredictionService.predict(request));
    }

    /**
     * Trigger AI model training (cron job hoặc manual).
     * Input: device_id, epochs (optional), learningRate (optional)
     * Output: accuracy, status, trained params
     */
    @PreAuthorize("hasRole(T(com.example.smart_garden.security.RbacRoles).ADMIN)")
    @PostMapping(ApiPaths.SEG_AI_TRAIN)
    public ApiResponse<AiTrainResponse> train(
            @Valid @RequestBody AiTrainRequest request) {
        return ApiResponse.ok(aiPredictionService.train(request));
    }

    /**
     * Lấy kết quả AI prediction mới nhất theo device.
     */
    @GetMapping(ApiPaths.SEG_AI_RESULTS)
    public ApiResponse<MlPredictionDetailResponse> getLatestResults(
            @PathVariable Long deviceId) {
        return ApiResponse.ok(aiPredictionService.getLatestResult(deviceId));
    }
}
