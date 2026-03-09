package com.example.smart_garden.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Cấu hình Gemini API.
 * Đọc từ application.properties với prefix "gemini".
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    /** API key từ Google AI Studio. Bắt buộc để chatbot AI hoạt động. */
    private String apiKey = "";

    /**
     * Danh sách model thử lần lượt khi gặp 429 quota.
     * VD: gemini-2.5-flash → gemini-1.5-flash → gemini-1.0-pro
     */
    private List<String> models = List.of("gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.0-pro");

    /** Nhiệt độ sinh văn bản (0.0 - 1.0). Thấp hơn = nhất quán hơn. */
    private double temperature = 0.4;

    /** Số token tối đa cho câu trả lời. */
    private int maxOutputTokens = 800;

    /** Timeout gọi Gemini API (ms). */
    private int timeoutMs = 30000;

    /** Số lượng chunks RAG được lấy để làm context. */
    private int topKChunks = 4;
}
