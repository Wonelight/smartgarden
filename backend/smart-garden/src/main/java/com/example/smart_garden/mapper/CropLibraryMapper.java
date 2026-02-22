package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.crop.request.AdminCreateCropLibraryRequest;
import com.example.smart_garden.dto.crop.response.CropLibraryDetailResponse;
import com.example.smart_garden.dto.crop.response.CropLibraryListItemResponse;
import com.example.smart_garden.entity.CropLibrary;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * MapStruct mapper cho CropLibrary entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface CropLibraryMapper {

    // ================== Entity to Response ==================

    CropLibraryDetailResponse toDetail(CropLibrary cropLibrary);

    CropLibraryListItemResponse toListItem(CropLibrary cropLibrary);

    List<CropLibraryListItemResponse> toListItems(List<CropLibrary> cropLibraries);

    // ================== Request to Entity ==================

    CropLibrary toEntity(AdminCreateCropLibraryRequest request);
}
