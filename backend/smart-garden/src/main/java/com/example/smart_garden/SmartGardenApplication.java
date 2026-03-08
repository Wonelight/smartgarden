package com.example.smart_garden;

import com.example.smart_garden.config.InitDataProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(InitDataProperties.class)
@EnableScheduling
@EnableAsync
public class SmartGardenApplication {

	public static void main(String[] args) {
		SpringApplication.run(SmartGardenApplication.class, args);
	}

}
