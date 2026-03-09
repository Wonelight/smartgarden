package com.example.smart_garden.service.chat;

import com.example.smart_garden.config.GeminiProperties;
import com.example.smart_garden.dto.chat.ChatResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Orchestrates the RAG pipeline:
 *  1. Retrieve most relevant knowledge chunks via BM25.
 *  2. Build a Vietnamese system prompt with the retrieved context.
 *  3. Call Gemini to generate the final answer.
 *  4. Return a {@link ChatResponse} (falls back to a polite sorry message if Gemini is unavailable).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String SYSTEM_PROMPT =
            "Bạn là trợ lý AI cho hệ thống tưới tiêu thông minh Smart Garden.\n"
            + "Trả lời ngắn gọn, chính xác bằng tiếng Việt. Dùng bullet points khi liệt kê.\n"
            + "CHỈ dựa vào tài liệu sau để trả lời. "
            + "Nếu tài liệu không có đủ thông tin, hãy nói: \"Mình chưa có thông tin về vấn đề này.\"\n\n"
            + "[TÀI LIỆU]\n%s\n[/TÀI LIỆU]\n\n"
            + "Câu hỏi: %s";

    private static final String FALLBACK_REPLY =
            "Xin lỗi, trợ lý AI hiện tạm thời không khả dụng 😅. "
            + "Vui lòng thử lại sau hoặc xem mục **Hỗ trợ** trong hệ thống!";

    private final RagService       ragService;
    private final GeminiService    geminiService;
    private final GeminiProperties props;

    /**
     * Handles a user chat message and returns an AI-generated (or fallback) response.
     */
    public ChatResponse chat(String message) {
        // 1. Retrieve top-k relevant chunks
        List<KnowledgeChunk> contextChunks = ragService.retrieve(message, props.getTopKChunks());

        String contextText = contextChunks.stream()
                .map(KnowledgeChunk::content)
                .collect(Collectors.joining("\n\n---\n\n"));

        // 2. Build prompt and call Gemini
        String prompt = String.format(SYSTEM_PROMPT, contextText, message);
        String reply  = geminiService.generate(prompt);

        boolean fromAi = reply != null && !reply.isBlank();
        if (!fromAi) {
            reply = FALLBACK_REPLY;
            log.debug("Using fallback reply for message: {}", message);
        }

        // 3. Collect source titles for attribution
        List<String> sources = contextChunks.stream()
                .map(KnowledgeChunk::title)
                .distinct()
                .collect(Collectors.toList());

        return new ChatResponse(reply, fromAi, sources);
    }
}
