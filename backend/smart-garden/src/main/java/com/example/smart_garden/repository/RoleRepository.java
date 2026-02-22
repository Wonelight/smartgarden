package com.example.smart_garden.repository;

import com.example.smart_garden.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Role entity.
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    /**
     * Find role by name.
     *
     * @param name Role name
     * @return Optional containing the role if found
     */
    Optional<Role> findByName(String name);

    /**
     * Find all roles by system flag.
     *
     * @param isSystem System role flag
     * @return List of roles
     */
    List<Role> findByIsSystem(Boolean isSystem);

    /**
     * Check if a role exists by name.
     *
     * @param name Role name
     * @return true if exists
     */
    boolean existsByName(String name);

    /**
     * Find role by ID with permissions eagerly fetched.
     *
     * @param id Role ID
     * @return Optional containing the role with permissions
     */
    @Query("SELECT r FROM Role r LEFT JOIN FETCH r.permissions WHERE r.id = :id")
    Optional<Role> findByIdWithPermissions(@Param("id") Long id);

    /**
     * Find all roles with permissions eagerly fetched.
     *
     * @return List of roles with permissions
     */
    @Query("SELECT DISTINCT r FROM Role r LEFT JOIN FETCH r.permissions")
    List<Role> findAllWithPermissions();
}
