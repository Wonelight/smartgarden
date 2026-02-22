package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.auth.ForgotPasswordRequest;
import com.example.smart_garden.dto.auth.ForgotPasswordResponse;
import com.example.smart_garden.dto.auth.ResetPasswordRequest;
import com.example.smart_garden.dto.auth.VerifyResetCodeRequest;
import com.example.smart_garden.dto.user.request.*;
import com.example.smart_garden.dto.user.response.*;
import com.example.smart_garden.entity.PasswordResetToken;
import com.example.smart_garden.entity.Role;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.UserMapper;
import com.example.smart_garden.repository.PasswordResetTokenRepository;
import com.example.smart_garden.repository.RoleRepository;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.service.EmailService;
import com.example.smart_garden.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Implementation của UserService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private EmailService emailService;

    // ================== SELF ==================

    @Override
    @Transactional
    public SelfUserDetailResponse register(SelfRegisterUserRequest request) {
        log.info("Registering new user: {}", request.username());

        // Check if username exists
        if (userRepository.existsByUsername(request.username())) {
            throw new AppException(ErrorCode.USER_EXISTED, "Username already exists");
        }

        // Check if email exists
        if (request.email() != null && userRepository.existsByEmail(request.email())) {
            throw new AppException(ErrorCode.USER_EXISTED, "Email already exists");
        }

        // Create user
        User user = userMapper.toEntity(request);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setIsActive(true);

        // Assign default USER role
        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        user.addRole(userRole);

        user = userRepository.save(user);
        log.info("User registered successfully: {}", user.getUsername());

        return userMapper.toSelfDetail(user);
    }

    @Override
    @Transactional(readOnly = true)
    public SelfUserDetailResponse getMyProfile() {
        User user = getCurrentUser();
        return userMapper.toSelfDetail(user);
    }

    @Override
    @Transactional
    public SelfUserDetailResponse updateMyProfile(SelfUpdateProfileRequest request) {
        User user = getCurrentUser();

        if (request.email() != null && !request.email().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.email())) {
                throw new AppException(ErrorCode.USER_EXISTED, "Email already exists");
            }
            user.setEmail(request.email());
        }

        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }

        user = userRepository.save(user);
        log.info("Profile updated for user: {}", user.getUsername());

        return userMapper.toSelfDetail(user);
    }

    @Override
    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User user = getCurrentUser();

        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_PASSWORD, "Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        log.info("Password changed for user: {}", user.getUsername());
    }

    @Override
    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        passwordResetTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());

        var userOpt = userRepository.findByEmail(request.email());
        if (userOpt.isEmpty()) {
            return ForgotPasswordResponse.success();
        }

        User user = userOpt.get();
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return ForgotPasswordResponse.success();
        }

        passwordResetTokenRepository.deleteByUser_Id(user.getId());

        String code = String.valueOf(100000 + ThreadLocalRandom.current().nextInt(900000));
        var resetToken = PasswordResetToken.builder()
                .token(code)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
        passwordResetTokenRepository.save(resetToken);
        log.info("Password reset code created for user: {}", user.getUsername());

        if (emailService != null) {
            try {
                emailService.sendPasswordResetCode(user.getEmail(), code);
            } catch (Exception e) {
                log.warn("Failed to send reset code email: {}", e.getMessage());
            }
        } else {
            log.info("[DEV] Password reset code for {}: {}", user.getEmail(), code);
        }

        return ForgotPasswordResponse.success();
    }

    @Override
    @Transactional(readOnly = true)
    public void verifyResetCode(VerifyResetCodeRequest request) {
        var userOpt = userRepository.findByEmail(request.email());
        if (userOpt.isEmpty()) {
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }
        var tokenOpt = passwordResetTokenRepository.findByUser_IdAndToken(userOpt.get().getId(), request.code());
        if (tokenOpt.isEmpty()) {
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }
        if (tokenOpt.get().isExpired()) {
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        var userOpt = userRepository.findByEmail(request.email());
        if (userOpt.isEmpty()) {
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }

        var tokenOpt = passwordResetTokenRepository.findByUser_IdAndToken(userOpt.get().getId(), request.code());
        if (tokenOpt.isEmpty()) {
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }

        PasswordResetToken resetToken = tokenOpt.get();
        if (resetToken.isExpired()) {
            passwordResetTokenRepository.delete(resetToken);
            throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        passwordResetTokenRepository.delete(resetToken);
        log.info("Password reset completed for user: {}", user.getUsername());
    }

    // ================== ADMIN ==================

    @Override
    @Transactional
    public AdminUserDetailResponse adminCreateUser(AdminCreateUserRequest request) {
        log.info("Admin creating new user: {}", request.username());

        if (userRepository.existsByUsername(request.username())) {
            throw new AppException(ErrorCode.USER_EXISTED, "Username already exists");
        }

        if (request.email() != null && userRepository.existsByEmail(request.email())) {
            throw new AppException(ErrorCode.USER_EXISTED, "Email already exists");
        }

        User user = userMapper.toEntity(request);
        user.setPassword(passwordEncoder.encode(request.password()));

        // Assign role (default to USER if not specified)
        String roleName = request.role() != null ? request.role() : "USER";
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        user.addRole(role);

        if (request.isActive() == null) {
            user.setIsActive(true);
        }

        user = userRepository.save(user);
        log.info("Admin created user: {}", user.getUsername());

        return userMapper.toAdminDetail(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserListItemResponse> adminGetAllUsers() {
        List<User> users = userRepository.findAll();
        return userMapper.toAdminListItems(users);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserDetailResponse adminGetUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return userMapper.toAdminDetail(user);
    }

    @Override
    @Transactional
    public AdminUserDetailResponse adminUpdateUser(Long id, AdminUpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (request.email() != null && !request.email().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.email())) {
                throw new AppException(ErrorCode.USER_EXISTED, "Email already exists");
            }
            user.setEmail(request.email());
        }

        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }
        if (request.role() != null) {
            // Clear existing roles and assign new role
            user.getRoles().clear();
            Role role = roleRepository.findByName(request.role())
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
            user.addRole(role);
        }
        if (request.isActive() != null) {
            user.setIsActive(request.isActive());
        }

        user = userRepository.save(user);
        log.info("Admin updated user: {}", user.getUsername());

        return userMapper.toAdminDetail(user);
    }

    @Override
    @Transactional
    public void adminDeleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.softDelete();
        userRepository.save(user);
        log.info("Admin deleted user: {}", user.getUsername());
    }

    // ================== HELPER METHODS ==================

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
