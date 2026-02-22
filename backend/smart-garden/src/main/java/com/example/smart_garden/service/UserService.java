package com.example.smart_garden.service;

import com.example.smart_garden.dto.auth.ForgotPasswordRequest;
import com.example.smart_garden.dto.auth.ForgotPasswordResponse;
import com.example.smart_garden.dto.auth.ResetPasswordRequest;
import com.example.smart_garden.dto.auth.VerifyResetCodeRequest;
import com.example.smart_garden.dto.user.request.*;
import com.example.smart_garden.dto.user.response.*;

import java.util.List;

/**
 * Service interface cho quản lý User.
 */
public interface UserService {

    // ================== SELF (User tự quản lý) ==================

    /**
     * Đăng ký tài khoản mới.
     */
    SelfUserDetailResponse register(SelfRegisterUserRequest request);

    /**
     * Lấy thông tin profile của user hiện tại.
     */
    SelfUserDetailResponse getMyProfile();

    /**
     * Cập nhật profile của user hiện tại.
     */
    SelfUserDetailResponse updateMyProfile(SelfUpdateProfileRequest request);

    /**
     * Đổi mật khẩu của user hiện tại.
     */
    void changePassword(ChangePasswordRequest request);

    /**
     * Yêu cầu đặt lại mật khẩu (gửi email hoặc trả token cho dev).
     */
    ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request);

    /**
     * Xác nhận mã đặt lại mật khẩu (bước 1). Không xóa token, chỉ validate.
     */
    void verifyResetCode(VerifyResetCodeRequest request);

    /**
     * Đặt lại mật khẩu bằng email và mã đã xác nhận.
     */
    void resetPassword(ResetPasswordRequest request);

    // ================== ADMIN ==================

    /**
     * Admin tạo user mới.
     */
    AdminUserDetailResponse adminCreateUser(AdminCreateUserRequest request);

    /**
     * Admin lấy danh sách tất cả users.
     */
    List<AdminUserListItemResponse> adminGetAllUsers();

    /**
     * Admin lấy chi tiết user theo ID.
     */
    AdminUserDetailResponse adminGetUserById(Long id);

    /**
     * Admin cập nhật user.
     */
    AdminUserDetailResponse adminUpdateUser(Long id, AdminUpdateUserRequest request);

    /**
     * Admin xóa user (soft delete).
     */
    void adminDeleteUser(Long id);
}
