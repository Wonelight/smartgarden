package com.example.smart_garden.service.chat;

/**
 * Một đoạn kiến thức trong knowledge base.
 *
 * @param id      Định danh duy nhất (filename#index).
 * @param title   Tiêu đề đoạn (từ dòng # đầu tiên).
 * @param content Nội dung đầy đủ của đoạn.
 * @param tokens  Mảng token đã tokenize (dùng cho BM25 scoring).
 */
public record KnowledgeChunk(
        String id,
        String title,
        String content,
        String[] tokens
) {}
