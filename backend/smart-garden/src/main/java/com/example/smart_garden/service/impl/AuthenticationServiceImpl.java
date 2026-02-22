package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.auth.LoginRequest;
import com.example.smart_garden.dto.auth.LoginResponse;
import com.example.smart_garden.entity.User;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.repository.UserRepository;
import com.example.smart_garden.security.JwtProperties;
import com.example.smart_garden.security.JwtTokenProvider;
import com.example.smart_garden.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation của AuthenticationService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        log.info("Login attempt for user: {}", request.username());

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.username(),
                            request.password()));

            SecurityContextHolder.getContext().setAuthentication(authentication);

            // Get user for roles
            User user = userRepository.findByUsername(request.username())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            // Get first role name (users typically have one primary role)
            String roleName = user.getRoles().stream()
                    .findFirst()
                    .map(role -> "ROLE_" + role.getName())
                    .orElse("ROLE_USER");

            String token = jwtTokenProvider.generateToken(
                    user.getUsername(),
                    roleName);

            String refreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());
            log.info("User logged in successfully: {}", request.username());
            return LoginResponse.of(token, refreshToken, jwtProperties.expiration());

        } catch (BadCredentialsException e) {
            log.warn("Bad credentials for user: {}", request.username());
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        } catch (DisabledException e) {
            log.warn("Disabled account for user: {}", request.username());
            throw new AppException(ErrorCode.ACCOUNT_DISABLED);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponse refreshToken(String refreshToken) {
        // Validate the refresh token
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN, "Invalid or expired refresh token");
        }

        String username = jwtTokenProvider.getUsernameFromToken(refreshToken);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException(ErrorCode.ACCOUNT_DISABLED);
        }

        // Get first role name (users typically have one primary role)
        String roleName = user.getRoles().stream()
                .findFirst()
                .map(role -> "ROLE_" + role.getName())
                .orElse("ROLE_USER");

        String newAccessToken = jwtTokenProvider.generateToken(
                user.getUsername(),
                roleName);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());

        log.info("Token refreshed for user: {}", username);
        return LoginResponse.of(newAccessToken, newRefreshToken, jwtProperties.expiration());
    }

    @Override
    public void logout() {
        // Clear the security context
        SecurityContextHolder.clearContext();
        log.info("User logged out");
    }
}
