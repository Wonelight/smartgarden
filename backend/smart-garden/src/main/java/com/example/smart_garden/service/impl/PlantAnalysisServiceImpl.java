package com.example.smart_garden.service.impl;

import com.example.smart_garden.config.AiServiceProperties;
import com.example.smart_garden.dto.plant.request.CameraCaptureRequest;
import com.example.smart_garden.dto.plant.request.PlantAnalyzeRequest;
import com.example.smart_garden.dto.plant.response.CameraCaptureResponse;
import com.example.smart_garden.dto.plant.response.CameraStatusResponse;
import com.example.smart_garden.dto.plant.response.PlantAnalyzeResponse;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.service.PlantAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Proxy service — forward plant analysis & camera requests
 * to AI Service (FastAPI at port 5000).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlantAnalysisServiceImpl implements PlantAnalysisService {

    private final RestTemplate restTemplate;
    private final AiServiceProperties aiServiceProperties;

    private static final String PLANT_ANALYZE = "/plant/analyze";
    private static final String CAMERA_CAPTURE = "/plant/camera/capture";
    private static final String CAMERA_STATUS = "/plant/camera/status";
    private static final String CAMERA_OPEN = "/plant/camera/open";
    private static final String CAMERA_CLOSE = "/plant/camera/close";
    private static final String CAMERA_STREAM = "/plant/camera/stream";

    // ── Analyze image ─────────────────────────────────

    @Override
    public PlantAnalyzeResponse analyze(PlantAnalyzeRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("device_id", request.deviceId());
        payload.put("image_base64", request.imageBase64());
        payload.put("task", request.task());
        payload.put("confidence_threshold", request.confidenceThreshold());

        return callAiService(
                PLANT_ANALYZE,
                HttpMethod.POST,
                payload,
                PlantAnalyzeResponse.class,
                "plant-analyze"
        );
    }

    // ── Camera capture ────────────────────────────────

    @Override
    public CameraCaptureResponse cameraCapture(CameraCaptureRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("confidence", request.confidence());
        payload.put("device_id", request.deviceId());

        return callAiService(
                CAMERA_CAPTURE,
                HttpMethod.POST,
                payload,
                CameraCaptureResponse.class,
                "camera-capture"
        );
    }

    // ── Camera status ─────────────────────────────────

    @Override
    public CameraStatusResponse cameraStatus() {
        return callAiService(
                CAMERA_STATUS,
                HttpMethod.GET,
                null,
                CameraStatusResponse.class,
                "camera-status"
        );
    }

    // ── Camera open ───────────────────────────────────

    @Override
    public void cameraOpen(int source) {
        Map<String, Object> payload = Map.of("source", source);
        callAiService(CAMERA_OPEN, HttpMethod.POST, payload, Map.class, "camera-open");
    }

    // ── Camera close ──────────────────────────────────

    @Override
    public void cameraClose() {
        callAiService(CAMERA_CLOSE, HttpMethod.POST, null, Map.class, "camera-close");
    }

    // ── Camera stream URL ─────────────────────────────

    @Override
    public String getCameraStreamUrl(boolean detect, float confidence, float fps) {
        return aiServiceProperties.getUrl()
                + CAMERA_STREAM
                + "?detect=" + detect
                + "&confidence=" + confidence
                + "&fps=" + fps;
    }

    // ── Generic HTTP caller ───────────────────────────

    private <T> T callAiService(
            String endpoint,
            HttpMethod method,
            Object body,
            Class<T> responseType,
            String operation) {
        try {
            String url = aiServiceProperties.getUrl() + endpoint;
            log.info("[PlantAnalysis] {} {}", method, url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);

            ResponseEntity<T> response = restTemplate.exchange(
                    url, method, entity, responseType);

            if (response.getBody() == null) {
                throw new AppException(ErrorCode.AI_PREDICTION_FAILED);
            }
            return response.getBody();

        } catch (ResourceAccessException e) {
            log.error("[PlantAnalysis] AI service unavailable for {}: {}", operation, e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("[PlantAnalysis] {} failed: {}", operation, e.getMessage(), e);
            throw new AppException(ErrorCode.AI_PREDICTION_FAILED);
        }
    }
}
