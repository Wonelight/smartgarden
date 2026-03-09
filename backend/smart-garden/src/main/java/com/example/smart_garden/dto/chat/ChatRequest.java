package com.example.smart_garden.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body cho POST /chat.
 */
public record ChatRequest(
        @NotBlank(message = "Message không được để trống")
        @Size(max = 600, message = "Message không vượt quá 600 ký tự")
        String message
) {}
