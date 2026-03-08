package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.common.PageResponse;
import com.example.smart_garden.dto.notification.response.NotificationResponse;
import com.example.smart_garden.entity.Notification;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.entity.enums.NotificationCategory;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.NotificationRepository;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getMyNotifications(int page, int size, NotificationCategory category) {
        Long userId = getCurrentUser().getId();
        Page<Notification> result = notificationRepository.findByUserIdWithFilter(
                userId, category, PageRequest.of(page, size));
        var content = result.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnread() {
        return notificationRepository.countByUserIdAndReadFalse(getCurrentUser().getId());
    }

    @Override
    @Transactional
    public void markAsRead(Long notificationId) {
        Long userId = getCurrentUser().getId();
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));
        if (!n.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (!n.isRead()) {
            n.setRead(true);
            notificationRepository.save(n);
        }
    }

    @Override
    @Transactional
    public void markAllAsRead() {
        notificationRepository.markAllAsReadForUser(getCurrentUser().getId());
    }

    // ========== helpers ==========

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType(),
                n.getCategory(),
                n.getDeviceId(),
                n.getDeviceName(),
                n.getTitle(),
                n.getMessage(),
                n.isRead(),
                n.getCreatedAt()
        );
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
