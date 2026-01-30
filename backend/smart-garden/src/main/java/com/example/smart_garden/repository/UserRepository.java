package com.example.smart_garden.repository;

import com.example.smart_garden.entity.User;
import com.example.smart_garden.entity.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Tìm user theo username
     */
    Optional<User> findByUsername(String username);

    /**
     * Tìm user theo email
     */
    Optional<User> findByEmail(String email);

    /**
     * Kiểm tra username đã tồn tại chưa
     */
    boolean existsByUsername(String username);

    /**
     * Kiểm tra email đã tồn tại chưa
     */
    boolean existsByEmail(String email);

    /**
     * Tìm user theo role
     */
    List<User> findByRole(UserRole role);

    /**
     * Tìm user đang active
     */
    List<User> findByIsActiveTrue();

    /**
     * Tìm user theo role và active status
     */
    List<User> findByRoleAndIsActiveTrue(UserRole role);

    /**
     * Tìm user theo username hoặc email
     */
    @Query("SELECT u FROM User u WHERE u.username = :identifier OR u.email = :identifier")
    Optional<User> findByUsernameOrEmail(@Param("identifier") String identifier);
}
