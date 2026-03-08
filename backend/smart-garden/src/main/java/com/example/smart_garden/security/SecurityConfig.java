package com.example.smart_garden.security;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.example.smart_garden.api.ApiPaths;

import java.util.Arrays;

/**
 * Cấu hình Security: Lambda DSL, stateless, JWT, CORS, @EnableMethodSecurity.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(JwtProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final Environment env;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(ApiPaths.AUTH_ALL).permitAll()
                        .requestMatchers(ApiPaths.USERS_REGISTER_PERMIT).permitAll()
                        // Khi server.servlet.context-path=/api, path tới filter có thể là
                        // /users/register (không có prefix /api)
                        .requestMatchers("/users/register").permitAll()
                        .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**")
                        .permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/ws/**").permitAll() // WebSocket STOMP endpoint
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/debug/**").authenticated() // Debug endpoint - requires authentication
                        .requestMatchers(ApiPaths.ADMIN_ALL).hasRole(RbacRoles.ADMIN)
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Parse allowed origins
        String allowedOrigins = env.getProperty("cors.allowed-origins", "http://localhost:3000");
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));

        // Parse allowed methods
        String allowedMethods = env.getProperty("cors.allowed-methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
        config.setAllowedMethods(Arrays.asList(allowedMethods.split(",")));

        // Handle allowed headers - use wildcard pattern for all headers
        String allowedHeaders = env.getProperty("cors.allowed-headers", "*");
        if ("*".equals(allowedHeaders.trim())) {
            config.addAllowedHeader("*");
        } else {
            config.setAllowedHeaders(Arrays.asList(allowedHeaders.split(",")));
        }

        // Parse exposed headers
        String exposedHeaders = env.getProperty("cors.exposed-headers", "Authorization");
        config.setExposedHeaders(Arrays.asList(exposedHeaders.split(",")));

        // Set credentials and max age
        config.setAllowCredentials(Boolean.parseBoolean(env.getProperty("cors.allow-credentials", "true")));
        config.setMaxAge(Long.parseLong(env.getProperty("cors.max-age", "3600")));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        int strength = env.getProperty("security.bcrypt.strength", Integer.class, 10);
        return new BCryptPasswordEncoder(strength);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
