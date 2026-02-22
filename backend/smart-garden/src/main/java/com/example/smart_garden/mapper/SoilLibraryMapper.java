package com.example.smart_garden.mapper;

import com.example.smart_garden.dto.soil.request.AdminCreateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.response.SoilLibraryDetailResponse;
import com.example.smart_garden.dto.soil.response.SoilLibraryListItemResponse;
import com.example.smart_garden.entity.SoilLibrary;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * MapStruct mapper cho SoilLibrary entity và DTOs.
 */
@Mapper(componentModel = "spring")
public interface SoilLibraryMapper {

    SoilLibraryDetailResponse toDetail(SoilLibrary soilLibrary);

    SoilLibraryListItemResponse toListItem(SoilLibrary soilLibrary);

    List<SoilLibraryListItemResponse> toListItems(List<SoilLibrary> soilLibraries);

    SoilLibrary toEntity(AdminCreateSoilLibraryRequest request);
}
