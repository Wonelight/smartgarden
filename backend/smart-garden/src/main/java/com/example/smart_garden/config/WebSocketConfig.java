package com.example.smart_garden.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket STOMP Configuration.
 * <p>
 * Client (Frontend) kết nối qua: ws://localhost:8081/api/ws
 * Subscribe: /topic/devices/{deviceCode}/sensor
 * /topic/devices/{deviceCode}/status
 * Server broadcast khi nhận MQTT từ ESP32.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final Environment env;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable simple broker for /topic destinations
        config.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[] { 25000, 25000 }) // Server heartbeat: 25s
                .setTaskScheduler(new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler() {
                    {
                        setPoolSize(1);
                        setThreadNamePrefix("ws-heartbeat-");
                        initialize();
                    }
                });
        // Application destination prefix (client → server messages, nếu cần)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String allowedOrigins = env.getProperty(
                "websocket.allowed-origins",
                "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175");

        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.split(","))
                .withSockJS(); // Fallback cho browser cũ

        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.split(",")); // Native WebSocket
    }
}
