package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.chat.ChatRequest;
import com.example.smart_garden.dto.chat.ChatResponse;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.service.chat.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * REST endpoint for the AI RAG chatbot.
 * POST /api/chat  →  returns an AI-generated (or fallback) reply.
 */
@RestController
@RequestMapping(ApiPaths.BASE)
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping(ApiPaths.SEG_CHAT)
    public ApiResponse<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        ChatResponse resp = chatService.chat(request.message());
        return ApiResponse.ok(resp);
    }
}
