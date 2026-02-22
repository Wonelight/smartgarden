package com.example.smart_garden.config;

import com.example.smart_garden.api.ApiPaths;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Cấu hình OpenAPI (Swagger) chung: info, JWT security scheme, server.
 */
@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_BEARER = "bearerAuth";
    private static final String SECURITY_SCHEME_NAME = "JWT";

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(apiInfo())
                .servers(servers())
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_BEARER))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_BEARER,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Nhập JWT trả về từ " + ApiPaths.AUTH_LOGIN)));
    }

    private static Info apiInfo() {
        return new Info()
                .title("Smart Garden API")
                .description("API quản lý vườn thông minh: thiết bị, tưới, lịch, cảm biến, người dùng.")
                .version("1.0")
                .contact(new Contact()
                        .name("Smart Garden Team"));
    }

    private static List<Server> servers() {
        Server local = new Server()
                .url("http://localhost:8080")
                .description("Local");
        return List.of(local);
    }
}
