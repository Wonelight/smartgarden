package com.example.smart_garden.service;

import com.example.smart_garden.dto.plant.request.CameraCaptureRequest;
import com.example.smart_garden.dto.plant.request.PlantAnalyzeRequest;
import com.example.smart_garden.dto.plant.response.CameraCaptureResponse;
import com.example.smart_garden.dto.plant.response.CameraStatusResponse;
import com.example.smart_garden.dto.plant.response.PlantAnalyzeResponse;

/**
 * Service cho plant disease detection + camera management.
 * Proxy requests đến AI Service (FastAPI).
 */
public interface PlantAnalysisService {

    /**
     * Gửi ảnh base64 để phân tích bệnh cây.
     */
    PlantAnalyzeResponse analyze(PlantAnalyzeRequest request);

    /**
     * Chụp 1 frame từ camera server-side, chạy YOLO.
     */
    CameraCaptureResponse cameraCapture(CameraCaptureRequest request);

    /**
     * Lấy trạng thái camera.
     */
    CameraStatusResponse cameraStatus();

    /**
     * Mở camera.
     */
    void cameraOpen(int source);

    /**
     * Đóng camera.
     */
    void cameraClose();

    /**
     * URL cho MJPEG stream — frontend dùng trực tiếp.
     */
    String getCameraStreamUrl(boolean detect, float confidence, float fps);
}
