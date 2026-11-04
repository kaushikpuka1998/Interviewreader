package com.interview.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Role-wise learning tracks (Java Backend, Frontend, Full Stack, ...): an ordered list of topics for a role. The text is in
 * resources/tracks.json; the question counts come from the database, and a signed-in member also sees how much of each step they have read.
 */
@Service
public class TrackService {

    private record Row(String id, String slug, String title, String difficulty) {}
    private record Cached(List<Row> rows, long at) {}

    private final Map<String, JsonNode> tracks = new LinkedHashMap<>();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();
    private final QuestionRepository questions;
    private final UserProgressRepository progress;

    public TrackService(QuestionRepository questions, UserProgressRepository progress, ObjectMapper mapper) throws Exception {
        this.questions = questions;
        this.progress = progress;
        try (InputStream in = new ClassPathResource("tracks.json").getInputStream()) {
            for (JsonNode t : mapper.readTree(in)) tracks.put(t.path("id").asText(), t);
        }
    }

    public boolean has(String id) { return tracks.containsKey(id); }

    public List<String> ids() { return List.copyOf(tracks.keySet()); }

    /** Every question of a step's topic, in reading order (cached for 10 minutes). */
    private List<Row> rows(String tech, String term) {
        String key = tech + "|" + term;
        Cached c = cache.get(key);
        if (c != null && System.currentTimeMillis() - c.at() < 600_000) return c.rows();
        List<Row> rows = new ArrayList<>();
        for (Object[] r : questions.topicQuestions(tech, term, PageRequest.of(0, 5000)))
            rows.add(new Row((String) r[0], ShareSlug.of((String) r[1]), String.valueOf(r[2] == null || ((String) r[2]).isBlank() ? r[1] : r[2]), (String) r[3]));
        cache.put(key, new Cached(rows, System.currentTimeMillis()));
        return rows;
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (JsonNode t : tracks.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.path("id").asText()); m.put("title", t.path("title").asText()); m.put("tagline", t.path("tagline").asText()); m.put("stack", t.get("stack"));
            int total = 0;
            for (JsonNode s : t.path("steps")) total += rows(s.path("tech").asText(), s.path("term").asText("").toLowerCase()).size();
            m.put("questions", total);
            out.add(m);
        }
        return out;
    }

    /** One track with each step's size and, when `u` is given, how much of it that member has read. Null if there is no such track. */
    public Map<String, Object> build(String id, User u) {
        JsonNode t = tracks.get(id);
        if (t == null) return null;
        Set<String> read = new HashSet<>();
        if (u != null) for (UserProgress p : progress.findByUserId(u.getId())) if (p.isRead()) read.add(p.getQuestionId());

        List<Map<String, Object>> steps = new ArrayList<>();
        int totalAll = 0, readAll = 0, n = 0;
        List<Map<String, Object>> scenarios = new ArrayList<>();
        for (JsonNode s : t.path("steps")) {
            String tech = s.path("tech").asText(), term = s.path("term").asText("").toLowerCase();
            List<Row> rows = rows(tech, term);
            if (rows.isEmpty()) continue;
            int done = 0;
            Row next = null;
            for (Row r : rows) { if (read.contains(r.id())) done++; else if (next == null) next = r; }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("n", ++n); m.put("title", s.path("title").asText()); m.put("why", s.path("why").asText()); m.put("tech", tech);
            m.put("total", rows.size()); m.put("read", done); m.put("percent", Math.round(100.0 * done / rows.size()));
            m.put("next", next == null ? null : Map.of("id", next.id(), "slug", next.slug(), "title", next.title()));
            steps.add(m);
            totalAll += rows.size(); readAll += done;
            if ("hld".equals(tech) && scenarios.isEmpty())
                rows.stream().filter(r -> r.title().toLowerCase().startsWith("design")).limit(8)
                        .forEach(r -> scenarios.add(Map.of("id", r.id(), "slug", r.slug(), "title", r.title())));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("id", "title", "tagline", "description")) out.put(k, t.path(k).asText());   // plain strings, not JSON nodes
        out.put("stack", t.get("stack"));
        out.put("steps", steps);
        out.put("scenarios", scenarios);
        out.put("total", totalAll); out.put("read", readAll); out.put("percent", totalAll == 0 ? 0 : Math.round(100.0 * readAll / totalAll));
        out.put("signedIn", u != null);
        return out;
    }
}
