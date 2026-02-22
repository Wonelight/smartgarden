package com.example.smart_garden.repository;

import com.example.smart_garden.entity.PasswordResetToken;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    Optional<PasswordResetToken> findByUser_IdAndToken(Long userId, String token);

    void deleteByExpiresAtBefore(LocalDateTime dateTime);

    void deleteByUser_Id(Long userId);
}
