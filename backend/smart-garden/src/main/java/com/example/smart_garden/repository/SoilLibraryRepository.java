package com.example.smart_garden.repository;

import com.example.smart_garden.entity.SoilLibrary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoilLibraryRepository extends JpaRepository<SoilLibrary, Long> {

    Optional<SoilLibrary> findByName(String name);

    List<SoilLibrary> findByNameContainingIgnoreCase(String name);
}
