package com.example.smart_garden.service.chat;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Retrieval service using BM25 scoring over in-memory knowledge chunks.
 * Index is built once at startup via @PostConstruct.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RagService {

    private static final double K1 = 1.2;
    private static final double B  = 0.75;

    private final KnowledgeBaseLoader loader;

    private List<KnowledgeChunk> chunks;
    private Map<String, Double> idf;
    private double avgDocLength;

    @PostConstruct
    public void init() {
        chunks = loader.loadChunks();
        buildIndex();
        log.info("RAG BM25 index ready: {} chunks, avg doc length = {:.1f} tokens", chunks.size(), avgDocLength);
    }

    /**
     * Retrieves the top-k most relevant chunks for the given query using BM25.
     */
    public List<KnowledgeChunk> retrieve(String query, int topK) {
        if (chunks == null || chunks.isEmpty()) return List.of();
        String[] queryTokens = tokenize(query);
        if (queryTokens.length == 0) return List.of();

        return chunks.stream()
                .sorted(Comparator.comparingDouble(c -> -bm25Score(queryTokens, c)))
                .limit(topK)
                .collect(Collectors.toList());
    }

    // ── BM25 helpers ─────────────────────────────────────────────────────────

    private void buildIndex() {
        int N = chunks.size();
        if (N == 0) return;

        long totalTokens = 0;
        Map<String, Integer> df = new HashMap<>();

        for (KnowledgeChunk chunk : chunks) {
            totalTokens += chunk.tokens().length;
            Set<String> uniqueTerms = new HashSet<>(Arrays.asList(chunk.tokens()));
            for (String term : uniqueTerms) {
                df.merge(term, 1, Integer::sum);
            }
        }

        avgDocLength = (double) totalTokens / N;

        idf = new HashMap<>();
        df.forEach((term, freq) ->
                idf.put(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1.0)));
    }

    private double bm25Score(String[] queryTokens, KnowledgeChunk chunk) {
        Map<String, Long> tf = Arrays.stream(chunk.tokens())
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()));

        double docLen = chunk.tokens().length;
        double score  = 0.0;

        for (String term : queryTokens) {
            long freq = tf.getOrDefault(term, 0L);
            if (freq == 0) continue;

            double idfScore   = idf.getOrDefault(term, 0.0);
            double numerator  = freq * (K1 + 1.0);
            double denominator = freq + K1 * (1.0 - B + B * docLen / avgDocLength);

            score += idfScore * (numerator / denominator);
        }
        return score;
    }

    // ── Tokeniser (reused by KnowledgeBaseLoader) ─────────────────────────────

    /**
     * Lowercases, strips non-alphanumeric/Vietnamese characters, splits on whitespace.
     */
    public static String[] tokenize(String text) {
        if (text == null || text.isBlank()) return new String[0];
        return text.toLowerCase()
                .replaceAll("[^a-z0-9"
                        + "àáảãạăắặẳẵâấậầẩẫ"
                        + "èéẻẽẹêếệềểễ"
                        + "ìíỉĩị"
                        + "òóỏõọôốộồổỗơớợờởỡ"
                        + "ùúủũụưứựừửữ"
                        + "ỳýỷỹỵđ"
                        + "\\s]", " ")
                .trim()
                .split("\\s+");
    }
}
