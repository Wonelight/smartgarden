package com.example.smart_garden.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Cấu hình RestTemplate bean cho gọi AI Python service.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(AiServiceProperties aiServiceProperties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(aiServiceProperties.getTimeout());
        factory.setReadTimeout(aiServiceProperties.getTimeout());
        return new RestTemplate(factory);
    }
}
