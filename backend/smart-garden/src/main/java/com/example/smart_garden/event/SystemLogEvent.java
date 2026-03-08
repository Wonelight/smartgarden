package com.example.smart_garden.event;

import com.example.smart_garden.entity.enums.LogLevel;
import com.example.smart_garden.entity.enums.LogSource;
import org.springframework.context.ApplicationEvent;

/**
 * Spring ApplicationEvent cho mọi sự kiện cần ghi vào bảng system_log.
 * Mang dữ liệu thuần (không giữ JPA entity) để tránh detached-entity khi async.
 */
public class SystemLogEvent extends ApplicationEvent {

    private final LogLevel logLevel;
    private final LogSource logSource;
    private final Long deviceId;       // nullable – log không gắn với device cụ thể
    private final String message;
    private final String stackTrace;   // nullable

    public SystemLogEvent(Object source, LogLevel logLevel, LogSource logSource,
                          Long deviceId, String message, String stackTrace) {
        super(source);
        this.logLevel = logLevel;
        this.logSource = logSource;
        this.deviceId = deviceId;
        this.message = message;
        this.stackTrace = stackTrace;
    }

    public LogLevel getLogLevel()    { return logLevel;    }
    public LogSource getLogSource()  { return logSource;   }
    public Long getDeviceId()        { return deviceId;    }
    public String getMessage()       { return message;     }
    public String getStackTrace()    { return stackTrace;  }
}
