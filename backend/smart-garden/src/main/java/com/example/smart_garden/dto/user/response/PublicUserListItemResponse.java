package com.example.smart_garden.dto.user.response;

/**
 * Item danh sách user cho hiển thị công khai / chia sẻ (ẩn thông tin nhạy cảm).
 */
public record PublicUserListItemResponse(
        Long id,
        String username,
        String fullName
) {
}

