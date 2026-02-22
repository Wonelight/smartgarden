package com.example.smart_garden.repository;

import com.example.smart_garden.entity.CropLibrary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CropLibraryRepository extends JpaRepository<CropLibrary, Long> {

    Optional<CropLibrary> findByName(String name);

    List<CropLibrary> findByNameContainingIgnoreCase(String name);
}
