package com.example.smart_garden.controller;

import com.example.smart_garden.dto.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Debug controller for development/testing purposes.
 * Should be disabled in production.
 */
@RestController
@RequestMapping("/api/debug")
@RequiredArgsConstructor
public class DebugController {

    @GetMapping("/auth")
    public ApiResponse<Map<String, Object>> getAuthInfo(Authentication authentication) {
        if (authentication == null) {
            return ApiResponse.ok(Map.of("authenticated", false));
        }

        Map<String, Object> authInfo = new HashMap<>();
        authInfo.put("authenticated", true);
        authInfo.put("username", authentication.getName());
        authInfo.put("principal", authentication.getPrincipal().getClass().getSimpleName());

        List<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());
        authInfo.put("authorities", authorities);

        return ApiResponse.ok(authInfo);
    }
}
