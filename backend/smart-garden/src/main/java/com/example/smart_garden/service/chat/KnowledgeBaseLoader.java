package com.example.smart_garden.service.chat;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Loads and parses the plaintext knowledge files from resources/knowledge/.
 * Each file is split on "\n---\n" separators into individual KnowledgeChunks.
 */
@Slf4j
@Component
public class KnowledgeBaseLoader {

    private static final String[] FILES = {
            "knowledge/fao56.txt",
            "knowledge/smart_garden.txt"
    };

    /**
     * Loads all knowledge chunks from all configured knowledge files.
     */
    public List<KnowledgeChunk> loadChunks() {
        List<KnowledgeChunk> all = new ArrayList<>();
        for (String file : FILES) {
            try {
                List<KnowledgeChunk> chunks = loadFile(file);
                all.addAll(chunks);
                log.info("Loaded {} chunks from {}", chunks.size(), file);
            } catch (Exception e) {
                log.warn("Could not load knowledge file '{}': {}", file, e.getMessage());
            }
        }
        log.info("Total knowledge chunks loaded: {}", all.size());
        return all;
    }

    private List<KnowledgeChunk> loadFile(String path) throws Exception {
        ClassPathResource resource = new ClassPathResource(path);
        String content;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            content = reader.lines().collect(Collectors.joining("\n"));
        }

        String[] parts = content.split("\n---\n");
        List<KnowledgeChunk> chunks = new ArrayList<>();

        for (int i = 0; i < parts.length; i++) {
            String raw = parts[i].trim();
            if (raw.isEmpty()) continue;

            String title = extractTitle(raw);
            String[] tokens = RagService.tokenize(raw);

            chunks.add(new KnowledgeChunk(path + "#" + i, title, raw, tokens));
        }
        return chunks;
    }

    private String extractTitle(String chunk) {
        return Arrays.stream(chunk.split("\n"))
                .filter(line -> line.startsWith("#"))
                .map(line -> line.replaceFirst("^#+\\s*", ""))
                .findFirst()
                .orElse("Smart Garden Documentation");
    }
}
