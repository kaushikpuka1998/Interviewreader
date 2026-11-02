package com.interview.backend.practice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * The voice interviewer's hand-written bank per design question: its scope (to answer "should I support X?"),
 * follow-ups per stage, deep-dive questions and pushbacks. Stored on the question in the database and imported by an
 * admin from private JSON files, so the content isn't part of the public repository.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewBanks {

    private static final List<String> STAGES = List.of("requirements", "estimation", "api", "highlevel", "scaling", "reliability", "tradeoffs");

    private final QuestionRepository questions;
    private final ObjectMapper json = new ObjectMapper();

    /** The bank stored on a question, or null when it has none. */
    public JsonNode of(Question q) {
        if (q.getInterviewBank() == null || q.getInterviewBank().isBlank()) return null;
        try { return json.readTree(q.getInterviewBank()); } catch (Exception e) { return null; }
    }

    /**
     * Admin import: {questionId: bank}. Each bank is checked for shape (scope, a question per stage, deep dives,
     * pushbacks of five strings with valid patterns) before it is stored. Returns what was stored and what wasn't.
     */
    public Map<String, Object> importBanks(JsonNode root) {
        int stored = 0;
        List<String> unknown = new ArrayList<>(), invalid = new ArrayList<>();
        for (Iterator<Map.Entry<String, JsonNode>> it = root.fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            if (e.getKey().startsWith("_")) continue;
            String problem = problem(e.getValue());
            if (problem != null) { invalid.add(e.getKey() + ": " + problem); continue; }
            if (questions.updateInterviewBank(e.getKey(), e.getValue().toString()) == 0) unknown.add(e.getKey());
            else stored++;
        }
        log.info("Interview banks imported: {} stored, {} unknown ids, {} invalid", stored, unknown.size(), invalid.size());
        return Map.of("stored", stored, "unknown", unknown, "invalid", invalid);
    }

    static String problem(JsonNode b) {
        if (b.path("scope").asText("").length() < 20) return "missing scope";
        for (String s : STAGES) if (!b.path("ask").path(s).isArray() || b.path("ask").path(s).isEmpty()) return "no " + s + " question";
        if (!b.path("deep").isArray() || b.path("deep").size() < 2) return "fewer than 2 deep dives";
        if (!b.path("push").isArray()) return "push must be a list";
        for (JsonNode row : b.path("push")) {
            if (!row.isArray() || row.size() != 5) return "each pushback needs 5 strings";
            try { java.util.regex.Pattern.compile(row.get(0).asText()); java.util.regex.Pattern.compile(row.get(2).asText()); }
            catch (Exception ex) { return "bad pattern in a pushback"; }
        }
        return null;
    }
}
