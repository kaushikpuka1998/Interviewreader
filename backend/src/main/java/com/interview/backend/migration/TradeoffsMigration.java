package com.interview.backend.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.cache.CacheManager;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Appends a "## Trade-offs" table to HLD answers from classpath tradeoffs.json on every startup.
 * Idempotent: skips answers that already have the section. Matches by title (ids/numbers differ per env).
 * Uses raw SQL so updated_at is untouched (the daily "edited questions" email keys off it).
 */
@Component
@Order(100) // after QuestionMigrationService has seeded an empty DB
@RequiredArgsConstructor
@Slf4j
public class TradeoffsMigration implements CommandLineRunner {

    private static final Pattern HAS_SECTION = Pattern.compile("(?m)^## Trade-offs\\s*$");
    private static final Pattern CHEAT_SHEET = Pattern.compile("(?m)^## \\d+\\. Interview cheat sheet");

    private final JdbcTemplate jdbc;
    private final CacheManager cacheManager;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void run(String... args) throws Exception {
        ClassPathResource res = new ClassPathResource("tradeoffs.json");
        if (!res.exists()) return;
        JsonNode root;
        try (InputStream in = res.getInputStream()) { root = mapper.readTree(in); }

        Map<String, String[]> byTitle = new HashMap<>(); // title -> {id, answer}
        jdbc.query("select id, title, answer from questions where tech = 'hld'",
                rs -> { byTitle.put(rs.getString("title"), new String[]{rs.getString("id"), rs.getString("answer")}); });

        int updated = 0;
        for (JsonNode entry : root) {
            String[] row = byTitle.get(entry.path("title").asText());
            if (row == null || row[1] == null || HAS_SECTION.matcher(row[1]).find()) continue;
            String answer = row[1].stripTrailing();
            String section = section(entry.path("rows"));
            Matcher m = CHEAT_SHEET.matcher(answer);
            String merged = m.find()
                    ? answer.substring(0, m.start()) + section + "\n\n" + answer.substring(m.start())
                    : answer + "\n\n" + section;
            jdbc.update("update questions set answer = ? where id = ?", merged, row[0]);
            updated++;
        }
        log.info("Trade-offs migration: {} of {} entries applied", updated, root.size());
        if (updated > 0) {
            for (String name : List.of("questionById", "questionSearch", "categories", "stats")) {
                var c = cacheManager.getCache(name);
                if (c != null) try { c.clear(); } catch (RuntimeException e) { log.warn("cache {} not cleared: {}", name, e.getMessage()); }
            }
        }
    }

    private static String section(JsonNode rows) {
        StringBuilder sb = new StringBuilder("## Trade-offs\n\n")
                .append("Every choice above buys something and costs something. Be ready to say both.\n\n")
                .append("| Choice | What you gain | What you give up |\n| --- | --- | --- |\n");
        for (JsonNode r : rows) {
            sb.append("| ").append(cell(r.path("choice"))).append(" | ").append(cell(r.path("gain")))
              .append(" | ").append(cell(r.path("cost"))).append(" |\n");
        }
        return sb.toString().stripTrailing();
    }

    private static String cell(JsonNode n) { return n.asText().replace("|", "\\|"); }
}
