package com.example.smart_garden.dto.common;

import java.util.List;

/**
 * Wrapper chuẩn cho response dạng phân trang.
 *
 * @param <T> kiểu phần tử trong danh sách
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {
}

