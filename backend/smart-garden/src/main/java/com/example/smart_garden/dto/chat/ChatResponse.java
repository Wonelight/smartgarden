package com.example.smart_garden.dto.chat;

import java.util.List;

/**
 * Response trả về từ chatbot.
 *
 * @param reply     Câu trả lời của chatbot.
 * @param fromAi    true nếu từ Gemini AI, false nếu fallback.
 * @param sources   Tiêu đề các chunk kiến thức được dùng (từ RAG).
 */
public record ChatResponse(
        String reply,
        boolean fromAi,
        List<String> sources
) {}
