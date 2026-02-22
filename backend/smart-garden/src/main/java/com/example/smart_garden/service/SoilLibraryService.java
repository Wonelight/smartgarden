package com.example.smart_garden.service;

import com.example.smart_garden.dto.soil.request.AdminCreateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.request.AdminUpdateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.response.SoilLibraryDetailResponse;
import com.example.smart_garden.dto.soil.response.SoilLibraryListItemResponse;

import java.util.List;

/**
 * Service interface cho quản lý SoilLibrary.
 */
public interface SoilLibraryService {

    SoilLibraryDetailResponse adminCreateSoilLibrary(AdminCreateSoilLibraryRequest request);

    List<SoilLibraryListItemResponse> adminGetAllSoilLibraries();

    SoilLibraryDetailResponse adminGetSoilLibraryById(Long id);

    SoilLibraryDetailResponse adminUpdateSoilLibrary(Long id, AdminUpdateSoilLibraryRequest request);

    void adminDeleteSoilLibrary(Long id);
}
