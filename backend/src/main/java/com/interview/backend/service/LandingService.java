package com.interview.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.QuestionRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Keyword landing pages (/java-interview-questions, /dsa/sliding-window, ...). The words live in resources/landing-pages.json, so a page is
 * added by editing that file; the question and problem lists are read from the database. The reader app and the crawler pages both use this.
 */
@Service
public class LandingService {

    private final Map<String, JsonNode> pages = new LinkedHashMap<>();
    private final QuestionRepository questions;
    private final CodingProblemRepository problems;

    public LandingService(QuestionRepository questions, CodingProblemRepository problems, ObjectMapper mapper) throws Exception {
        this.questions = questions;
        this.problems = problems;
        try (InputStream in = new ClassPathResource("landing-pages.json").getInputStream()) {
            for (JsonNode p : mapper.readTree(in)) pages.put(p.path("path").asText(), p);
        }
    }

    public List<String> paths() { return List.copyOf(pages.keySet()); }

    public boolean has(String path) { return pages.containsKey(path); }

    public JsonNode config(String path) { return pages.get(path); }

    /** The page's text plus its question and problem lists, or null when there is no such page. */
    public Map<String, Object> build(String path) {
        JsonNode p = pages.get(path);
        if (p == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("path", "title", "description", "h1", "intro", "links", "faq")) out.put(k, p.get(k));

        List<Map<String, Object>> qs = new ArrayList<>();
        if (p.hasNonNull("tech")) {
            String term = p.path("term").asText("").toLowerCase();
            int limit = p.path("limit").asInt(50);
            for (Object[] r : questions.topicQuestions(p.get("tech").asText(), term, PageRequest.of(0, limit))) {
                Map<String, Object> q = new LinkedHashMap<>();
                q.put("id", r[0]);
                q.put("title", r[2] == null || ((String) r[2]).isBlank() ? r[1] : r[2]);
                q.put("slug", ShareSlug.of((String) r[1]));
                q.put("difficulty", r[3]);
                qs.add(q);
            }
        }
        out.put("questions", qs);

        List<Map<String, Object>> ps = new ArrayList<>();
        String topic = p.path("problemTopic").asText(""), company = p.path("problemCompany").asText("");
        if (!topic.isEmpty() || !company.isEmpty()) {
            int limit = p.path("problemLimit").asInt(50);
            for (var s : problems.findSummariesByOrderByIdAsc()) {
                if (!topic.isEmpty() && !csv(s.getTopics()).contains(topic)) continue;
                if (!company.isEmpty() && !csv(s.getCompanies()).contains(company)) continue;
                ps.add(Map.of("id", s.getId(), "title", s.getTitle(), "difficulty", s.getDifficulty() == null ? "" : s.getDifficulty()));
                if (ps.size() >= limit) break;
            }
        }
        out.put("problems", ps);
        return out;
    }

    private static List<String> csv(String s) {
        return s == null || s.isBlank() ? List.of() : java.util.Arrays.stream(s.split(",")).map(String::trim).toList();
    }
}
