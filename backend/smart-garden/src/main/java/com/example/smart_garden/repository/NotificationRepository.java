package com.example.smart_garden.repository;

import com.example.smart_garden.entity.Notification;
import com.example.smart_garden.entity.enums.NotificationCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query("""
            SELECT n FROM Notification n
            WHERE n.userId = :userId
              AND (:category IS NULL OR n.category = :category)
            ORDER BY n.createdAt DESC
            """)
    Page<Notification> findByUserIdWithFilter(
            @Param("userId") Long userId,
            @Param("category") NotificationCategory category,
            Pageable pageable);

    long countByUserIdAndReadFalse(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.userId = :userId AND n.read = false")
    void markAllAsReadForUser(@Param("userId") Long userId);
}
