package com.example.smart_garden.event;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Convenience wrapper để các service publish SystemLogEvent mà không cần
 * import ApplicationEventPublisher trực tiếp.
 *
 * Các service chỉ cần inject SystemLogPublisher rồi gọi:
 *   sysLog.info(LogSource.BACKEND, deviceId, "message");
 */
@Component
@RequiredArgsConstructor
public class SystemLogPublisher {

    private final ApplicationEventPublisher publisher;

    public void info(LogSource source, Long deviceId, String message) {
        publish(LogLevel.INFO, source, deviceId, message, null);
    }

    public void warn(LogSource source, Long deviceId, String message) {
        publish(LogLevel.WARNING, source, deviceId, message, null);
    }

    public void error(LogSource source, Long deviceId, String message) {
        publish(LogLevel.ERROR, source, deviceId, message, null);
    }

    public void error(LogSource source, Long deviceId, String message, String stackTrace) {
        publish(LogLevel.ERROR, source, deviceId, message, stackTrace);
    }

    private void publish(LogLevel level, LogSource source, Long deviceId,
                         String message, String stackTrace) {
        publisher.publishEvent(new SystemLogEvent(this, level, source, deviceId, message, stackTrace));
    }
}
