package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.crop.request.AdminCreateCropLibraryRequest;
import com.example.smart_garden.dto.crop.request.AdminUpdateCropLibraryRequest;
import com.example.smart_garden.dto.crop.response.CropLibraryDetailResponse;
import com.example.smart_garden.dto.crop.response.CropLibraryListItemResponse;
import com.example.smart_garden.entity.CropLibrary;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.CropLibraryMapper;
import com.example.smart_garden.repository.CropLibraryRepository;
import com.example.smart_garden.service.CropLibraryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Implementation của CropLibraryService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CropLibraryServiceImpl implements CropLibraryService {

    private final CropLibraryRepository cropLibraryRepository;
    private final CropLibraryMapper cropLibraryMapper;

    @Override
    @Transactional
    public CropLibraryDetailResponse adminCreateCropLibrary(AdminCreateCropLibraryRequest request) {
        log.info("Admin creating crop library: {}", request.name());

        // Check if name already exists
        if (cropLibraryRepository.findByName(request.name()).isPresent()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Crop library with name '" + request.name() + "' already exists");
        }

        CropLibrary cropLibrary = cropLibraryMapper.toEntity(request);
        cropLibrary = cropLibraryRepository.save(cropLibrary);
        log.info("Admin created crop library: {}", cropLibrary.getName());

        return cropLibraryMapper.toDetail(cropLibrary);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CropLibraryListItemResponse> adminGetAllCropLibraries() {
        List<CropLibrary> cropLibraries = cropLibraryRepository.findAll();
        return cropLibraryMapper.toListItems(cropLibraries);
    }

    @Override
    @Transactional(readOnly = true)
    public CropLibraryDetailResponse adminGetCropLibraryById(Long id) {
        CropLibrary cropLibrary = cropLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Crop library not found"));
        return cropLibraryMapper.toDetail(cropLibrary);
    }

    @Override
    @Transactional
    public CropLibraryDetailResponse adminUpdateCropLibrary(Long id, AdminUpdateCropLibraryRequest request) {
        CropLibrary cropLibrary = cropLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Crop library not found"));

        // Check if new name conflicts with existing crop library
        if (request.name() != null && !request.name().equals(cropLibrary.getName())) {
            if (cropLibraryRepository.findByName(request.name()).isPresent()) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Crop library with name '" + request.name() + "' already exists");
            }
        }

        // Update fields
        if (request.name() != null) {
            cropLibrary.setName(request.name());
        }
        if (request.kcIni() != null) {
            cropLibrary.setKcIni(request.kcIni());
        }
        if (request.kcMid() != null) {
            cropLibrary.setKcMid(request.kcMid());
        }
        if (request.kcEnd() != null) {
            cropLibrary.setKcEnd(request.kcEnd());
        }
        if (request.stageIniDays() != null) {
            cropLibrary.setStageIniDays(request.stageIniDays());
        }
        if (request.stageDevDays() != null) {
            cropLibrary.setStageDevDays(request.stageDevDays());
        }
        if (request.stageMidDays() != null) {
            cropLibrary.setStageMidDays(request.stageMidDays());
        }
        if (request.stageEndDays() != null) {
            cropLibrary.setStageEndDays(request.stageEndDays());
        }
        if (request.maxRootDepth() != null) {
            cropLibrary.setMaxRootDepth(request.maxRootDepth());
        }
        if (request.depletionFraction() != null) {
            cropLibrary.setDepletionFraction(request.depletionFraction());
        }

        cropLibrary = cropLibraryRepository.save(cropLibrary);
        log.info("Admin updated crop library: {}", cropLibrary.getName());

        return cropLibraryMapper.toDetail(cropLibrary);
    }

    @Override
    @Transactional
    public void adminDeleteCropLibrary(Long id) {
        CropLibrary cropLibrary = cropLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Crop library not found"));

        cropLibrary.softDelete();
        cropLibraryRepository.save(cropLibrary);
        log.info("Admin deleted crop library: {}", cropLibrary.getName());
    }
}
