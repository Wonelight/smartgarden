package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.soil.request.AdminCreateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.request.AdminUpdateSoilLibraryRequest;
import com.example.smart_garden.dto.soil.response.SoilLibraryDetailResponse;
import com.example.smart_garden.dto.soil.response.SoilLibraryListItemResponse;
import com.example.smart_garden.entity.SoilLibrary;
import com.example.smart_garden.exception.AppException;
import com.example.smart_garden.exception.ErrorCode;
import com.example.smart_garden.mapper.SoilLibraryMapper;
import com.example.smart_garden.repository.CropSeasonRepository;
import com.example.smart_garden.repository.SoilLibraryRepository;
import com.example.smart_garden.service.SoilLibraryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoilLibraryServiceImpl implements SoilLibraryService {

    private final SoilLibraryRepository soilLibraryRepository;
    private final CropSeasonRepository cropSeasonRepository;
    private final SoilLibraryMapper soilLibraryMapper;

    @Override
    @Transactional
    public SoilLibraryDetailResponse adminCreateSoilLibrary(AdminCreateSoilLibraryRequest request) {
        log.info("Admin creating soil library: {}", request.name());

        if (soilLibraryRepository.findByName(request.name()).isPresent()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Loại đất với tên '" + request.name() + "' đã tồn tại");
        }

        if (request.wiltingPoint() >= request.fieldCapacity()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Điểm héo (WP) phải nhỏ hơn dung tích đồng ruộng (FC)");
        }

        SoilLibrary entity = soilLibraryMapper.toEntity(request);
        entity = soilLibraryRepository.save(entity);
        log.info("Admin created soil library: {}", entity.getName());
        return soilLibraryMapper.toDetail(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SoilLibraryListItemResponse> adminGetAllSoilLibraries() {
        return soilLibraryMapper.toListItems(soilLibraryRepository.findAll());
    }

    @Override
    @Transactional(readOnly = true)
    public SoilLibraryDetailResponse adminGetSoilLibraryById(Long id) {
        SoilLibrary soil = soilLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SOIL_NOT_FOUND, "Loại đất không tồn tại"));
        return soilLibraryMapper.toDetail(soil);
    }

    @Override
    @Transactional
    public SoilLibraryDetailResponse adminUpdateSoilLibrary(Long id, AdminUpdateSoilLibraryRequest request) {
        SoilLibrary soil = soilLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SOIL_NOT_FOUND, "Loại đất không tồn tại"));

        if (request.name() != null && !request.name().equals(soil.getName())) {
            if (soilLibraryRepository.findByName(request.name()).isPresent()) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "Loại đất với tên '" + request.name() + "' đã tồn tại");
            }
            soil.setName(request.name());
        }

        if (request.fieldCapacity() != null) {
            soil.setFieldCapacity(request.fieldCapacity());
        }
        if (request.wiltingPoint() != null) {
            soil.setWiltingPoint(request.wiltingPoint());
        }
        if (request.infiltrationShallowRatio() != null) {
            soil.setInfiltrationShallowRatio(request.infiltrationShallowRatio());
        }

        if (soil.getWiltingPoint() >= soil.getFieldCapacity()) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Điểm héo (WP) phải nhỏ hơn dung tích đồng ruộng (FC)");
        }

        soil = soilLibraryRepository.save(soil);
        log.info("Admin updated soil library: {}", soil.getName());
        return soilLibraryMapper.toDetail(soil);
    }

    @Override
    @Transactional
    public void adminDeleteSoilLibrary(Long id) {
        SoilLibrary soil = soilLibraryRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SOIL_NOT_FOUND, "Loại đất không tồn tại"));

        if (cropSeasonRepository.existsBySoil_Id(id)) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa loại đất đang được sử dụng bởi mùa vụ. Vui lòng đổi loại đất ở mùa vụ trước.");
        }

        soil.softDelete();
        soilLibraryRepository.save(soil);
        log.info("Admin deleted soil library: {}", soil.getName());
    }
}
