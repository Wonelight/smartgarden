package com.example.smart_garden.service.chat;

import com.example.smart_garden.config.GeminiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Calls the Gemini REST API to generate a response for a given prompt.
 * Falls back gracefully (returns null) on any error so ChatService can use a local fallback.
 */
@Slf4j
@Service
public class GeminiService {

    private static final String API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    private final GeminiProperties props;
    private final RestTemplate       restTemplate;
    private final ObjectMapper        mapper;

    public GeminiService(GeminiProperties props, ObjectMapper mapper) {
        this.props       = props;
        this.mapper      = mapper;
        this.restTemplate = buildRestTemplate(props.getTimeoutMs());
    }

    // Sentinel nội bộ: model này đã hết quota, thử model tiếp theo
    private static final String QUOTA_EXCEEDED = "__QUOTA_EXCEEDED__";

    /**
     * Gửi {@code prompt} lên Gemini và trả về văn bản được tạo.
     * Thử lần lượt từng model trong danh sách {@code gemini.models}.
     * Nếu model gặp 429 (quota) → chuyển sang model kế tiếp.
     * Trả {@code null} khi tất cả models đều lỗi → ChatService dùng fallback nội bộ.
     */
    public String generate(String prompt) {
        if (props.getApiKey() == null || props.getApiKey().isBlank()) {
            log.warn("Gemini API key chưa được cấu hình – bỏ qua AI call");
            return null;
        }

        List<String> models = props.getModels();
        if (models == null || models.isEmpty()) {
            log.warn("Không có model Gemini nào được cấu hình");
            return null;
        }

        for (int i = 0; i < models.size(); i++) {
            String model = models.get(i);
            String result = callModel(model, prompt);

            if (result == null) {
                // Lỗi cứng (network, parse...) – dừng luôn, không thử tiếp
                return null;
            }
            if (!result.equals(QUOTA_EXCEEDED)) {
                // Thành công
                if (i > 0) log.info("Gemini: dùng model fallback thành công: {}", model);
                return result;
            }
            // QUOTA_EXCEEDED → thử model tiếp theo
            if (i < models.size() - 1) {
                log.warn("Gemini model {} hết quota (429), chuyển sang: {}", model, models.get(i + 1));
            }
        }

        log.warn("Tất cả {} Gemini model đều hết quota – dùng fallback nội bộ", models.size());
        return null;
    }

    /** Gọi một model cụ thể. Trả QUOTA_EXCEEDED nếu 429, null nếu lỗi khác, text nếu thành công. */
    private String callModel(String model, String prompt) {
        String url = String.format(API_URL, model, props.getApiKey());

        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature",     props.getTemperature(),
                        "maxOutputTokens", props.getMaxOutputTokens()
                )
        );

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response =
                    restTemplate.postForEntity(url, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return extractText(response.getBody());
            }
            log.warn("Gemini [{}] trả về status không thành công: {}", model, response.getStatusCode());
            return null;

        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                return QUOTA_EXCEEDED;
            }
            log.error("Gemini [{}] lỗi HTTP {}: {}", model, e.getStatusCode(), e.getMessage());
            return null;
        } catch (Exception e) {
            log.error("Gemini [{}] gọi API thất bại: {}", model, e.getMessage());
            return null;
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String extractText(String json) {
        try {
            JsonNode root = mapper.readTree(json);
            String text = root.at("/candidates/0/content/parts/0/text").asText(null);
            if (text == null || text.isBlank()) {
                log.warn("Gemini response unexpectedly empty");
            }
            return text;
        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage());
            return null;
        }
    }

    private static RestTemplate buildRestTemplate(int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(readTimeoutMs);
        return new RestTemplate(factory);
    }
}
