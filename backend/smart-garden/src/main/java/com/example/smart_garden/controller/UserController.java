package com.example.smart_garden.controller;

import com.example.smart_garden.api.ApiPaths;
import com.example.smart_garden.dto.common.ApiResponse;
import com.example.smart_garden.dto.user.request.ChangePasswordRequest;
import com.example.smart_garden.dto.user.request.SelfRegisterUserRequest;
import com.example.smart_garden.dto.user.request.SelfUpdateProfileRequest;
import com.example.smart_garden.dto.user.response.SelfUserDetailResponse;
import com.example.smart_garden.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * API user: đăng ký (public), profile & đổi mật khẩu (user).
 * RequestMapping "/users" vì context-path đã là /api → URL thực tế /api/users/...
 */
@RestController
@RequestMapping(ApiPaths.SEG_USERS)
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ================== PUBLIC ==================

    @PostMapping("/register")
    public ApiResponse<SelfUserDetailResponse> register(
            @Valid @RequestBody SelfRegisterUserRequest request) {
        return ApiResponse.ok(userService.register(request));
    }

    // ================== SELF (User) ==================

    @GetMapping("/me")
    public ApiResponse<SelfUserDetailResponse> getMyProfile() {
        return ApiResponse.ok(userService.getMyProfile());
    }

    @PutMapping("/me")
    public ApiResponse<SelfUserDetailResponse> updateMyProfile(
            @Valid @RequestBody SelfUpdateProfileRequest request) {
        return ApiResponse.ok(userService.updateMyProfile(request));
    }

    @PostMapping("/me/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(request);
        return ApiResponse.ok(null);
    }
}
