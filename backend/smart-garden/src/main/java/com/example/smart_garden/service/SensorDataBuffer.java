package com.example.smart_garden.service;

import com.example.smart_garden.entity.SensorData;
import com.example.smart_garden.repository.SensorDataRepository;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe in-memory buffer cho sensor data.
 *
 * Thay vì INSERT từng bản ghi khi MQTT message đến,
 * dữ liệu được gom vào queue và flush batch:
 * - Mỗi 30 giây (scheduled)
 * - Hoặc khi buffer đạt 50 items (early flush)
 *
 * Giảm ~180x số database round-trip so với per-message INSERT.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SensorDataBuffer {

    private final SensorDataRepository sensorDataRepository;

    private final ConcurrentLinkedQueue<SensorData> queue = new ConcurrentLinkedQueue<>();
    private final AtomicInteger size = new AtomicInteger(0);

    private static final int EARLY_FLUSH_THRESHOLD = 50;

    /**
     * Thêm sensor data vào buffer (non-blocking).
     * Nếu buffer đạt threshold, trigger early flush.
     */
    public void add(SensorData data) {
        queue.add(data);
        int currentSize = size.incrementAndGet();

        if (currentSize >= EARLY_FLUSH_THRESHOLD) {
            flush();
        }
    }

    /**
     * Flush toàn bộ buffer vào database (batch insert).
     * Chạy mỗi 30 giây hoặc khi buffer đầy.
     * Sử dụng Hibernate batch_size=20 đã cấu hình sẵn.
     */
    @Scheduled(fixedRate = 30_000)
    @Transactional
    public void flush() {
        List<SensorData> batch = new ArrayList<>();
        SensorData item;
        while ((item = queue.poll()) != null) {
            batch.add(item);
        }
        size.set(0); // Reset counter (approximate, but sufficient)

        if (batch.isEmpty()) {
            return;
        }

        try {
            sensorDataRepository.saveAll(batch);
            log.info("⚡ Flushed {} sensor data records to database", batch.size());
        } catch (Exception e) {
            log.error("❌ Failed to flush sensor data buffer ({} records): {}",
                    batch.size(), e.getMessage(), e);
            // Re-queue failed items for next flush attempt
            queue.addAll(batch);
            size.addAndGet(batch.size());
        }
    }

    /**
     * Đảm bảo flush khi shutdown để không mất dữ liệu.
     */
    @PreDestroy
    public void onShutdown() {
        log.info("Application shutting down — flushing remaining sensor data buffer...");
        flush();
    }

    /**
     * Số lượng items hiện tại trong buffer (xấp xỉ).
     */
    public int getBufferSize() {
        return size.get();
    }
}
