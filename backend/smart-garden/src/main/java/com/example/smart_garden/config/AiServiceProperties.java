package com.example.smart_garden.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình AI Service (Python FastAPI).
 * Dùng chung cho tất cả model: ANFIS, RandomForest, FAO, v.v.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "ai-service")
public class AiServiceProperties {

    private String url = "http://localhost:5000";
    private String predictEndpoint = "/ai/predict";
    private String trainEndpoint = "/ai/train";
    private int timeout = 60000;
    private int defaultEpochs = 100;
    private float defaultLearningRate = 0.01f;
}
