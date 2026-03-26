package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.plant.request.CameraCaptureRequest;
import com.example.smart_garden.dto.plant.request.PlantAnalyzeRequest;
import com.example.smart_garden.dto.plant.response.CameraCaptureResponse;
import com.example.smart_garden.dto.plant.response.CameraStatusResponse;
import com.example.smart_garden.dto.plant.response.PlantAnalyzeResponse;
import com.example.smart_garden.service.PlantAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * API endpoints cho Plant Disease Detection + Camera.
 *
 * POST /api/plant/analyze          — gửi ảnh base64 phân tích bệnh
 * POST /api/plant/camera/capture   — chụp từ camera + detect
 * GET  /api/plant/camera/status    — trạng thái camera
 * POST /api/plant/camera/open      — mở camera
 * POST /api/plant/camera/close     — đóng camera
 * GET  /api/plant/camera/stream    — trả URL cho MJPEG stream
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class PlantController {

    private final PlantAnalysisService plantAnalysisService;

    /**
     * Phân tích ảnh cây trồng — detect / classify / segment.
     */
    @PostMapping(ApiPaths.SEG_PLANT_ANALYZE)
    public ApiResponse<PlantAnalyzeResponse> analyze(
            @Valid @RequestBody PlantAnalyzeRequest request) {
        return ApiResponse.ok(plantAnalysisService.analyze(request));
    }

    /**
     * Chụp 1 frame từ camera server-side, chạy YOLO detection.
     */
    @PostMapping(ApiPaths.SEG_PLANT_CAMERA_CAPTURE)
    public ApiResponse<CameraCaptureResponse> cameraCapture(
            @Valid @RequestBody(required = false) CameraCaptureRequest request) {
        if (request == null) {
            request = new CameraCaptureRequest(0L, 0.25f);
        }
        return ApiResponse.ok(plantAnalysisService.cameraCapture(request));
    }

    /**
     * Kiểm tra trạng thái camera.
     */
    @GetMapping(ApiPaths.SEG_PLANT_CAMERA_STATUS)
    public ApiResponse<CameraStatusResponse> cameraStatus() {
        return ApiResponse.ok(plantAnalysisService.cameraStatus());
    }

    /**
     * Mở camera (source = 0 mặc định).
     */
    @PostMapping(ApiPaths.SEG_PLANT_CAMERA_OPEN)
    public ApiResponse<String> cameraOpen(
            @RequestParam(defaultValue = "0") int source) {
        plantAnalysisService.cameraOpen(source);
        return ApiResponse.ok("Camera đã mở (source=" + source + ")");
    }

    /**
     * Đóng camera.
     */
    @PostMapping(ApiPaths.SEG_PLANT_CAMERA_CLOSE)
    public ApiResponse<String> cameraClose() {
        plantAnalysisService.cameraClose();
        return ApiResponse.ok("Camera đã đóng");
    }

    /**
     * Trả URL MJPEG stream từ AI service.
     * Frontend sử dụng URL này trong thẻ img.
     */
    @GetMapping(ApiPaths.SEG_PLANT_CAMERA_STREAM)
    public ApiResponse<String> getCameraStreamUrl(
            @RequestParam(defaultValue = "true") boolean detect,
            @RequestParam(defaultValue = "0.25") float confidence,
            @RequestParam(defaultValue = "10") float fps) {
        String url = plantAnalysisService.getCameraStreamUrl(detect, confidence, fps);
        return ApiResponse.ok(url);
    }
}
