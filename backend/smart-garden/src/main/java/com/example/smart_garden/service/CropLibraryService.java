package com.example.smart_garden.service;

import com.example.smart_garden.dto.crop.request.AdminCreateCropLibraryRequest;
import com.example.smart_garden.dto.crop.request.AdminUpdateCropLibraryRequest;
import com.example.smart_garden.dto.crop.response.CropLibraryDetailResponse;
import com.example.smart_garden.dto.crop.response.CropLibraryListItemResponse;

import java.util.List;

/**
 * Service interface cho quản lý CropLibrary.
 */
public interface CropLibraryService {

    /**
     * Admin tạo crop library mới.
     */
    CropLibraryDetailResponse adminCreateCropLibrary(AdminCreateCropLibraryRequest request);

    /**
     * Admin lấy danh sách tất cả crop libraries.
     */
    List<CropLibraryListItemResponse> adminGetAllCropLibraries();

    /**
     * Admin lấy chi tiết crop library theo ID.
     */
    CropLibraryDetailResponse adminGetCropLibraryById(Long id);

    /**
     * Admin cập nhật crop library.
     */
    CropLibraryDetailResponse adminUpdateCropLibrary(Long id, AdminUpdateCropLibraryRequest request);

    /**
     * Admin xóa crop library (soft delete).
     */
    void adminDeleteCropLibrary(Long id);
}
