package com.example.smart_garden.repository;

import com.example.smart_garden.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Permission entity.
 */
@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {

    /**
     * Find permission by name.
     *
     * @param name Permission name
     * @return Optional containing the permission if found
     */
    Optional<Permission> findByName(String name);

    /**
     * Find all permissions by category.
     *
     * @param category Permission category
     * @return List of permissions in the category
     */
    List<Permission> findByCategory(String category);

    /**
     * Check if a permission exists by name.
     *
     * @param name Permission name
     * @return true if exists
     */
    boolean existsByName(String name);
}
