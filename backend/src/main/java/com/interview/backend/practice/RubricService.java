package com.interview.backend.practice;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Rubrics for solo system design practice. A question's rubric is, in order of preference: the one stored on the
 * question (hand-written and imported by an admin, or edited in Admin), else an auto-draft from its model answer. Whatever is used first is stored, so a question's scoring doesn't drift between attempts.
 */
@Slf4j
@Service
public class RubricService {

    private final QuestionRepository questions;
    private final ObjectMapper json = new ObjectMapper();

    public RubricService(QuestionRepository questions) {
        this.questions = questions;
    }

    /** "Design …" questions in the HLD topic are the ones that can be practised. */
    // Named systems that aren't phrased "Design …": "SIP Stock Allocation System — HLD + LLD", "Real-Time Trading Application".
    // Not concept questions ("What is a stateless service?") or study topics ("… for common system design problems").
    private static final java.util.regex.Pattern NAMED_SYSTEM =
            java.util.regex.Pattern.compile("\\b(system|platform|service|application|app|engine|architecture)\\b");
    private static final java.util.regex.Pattern QUESTION_START = java.util.regex.Pattern.compile(
            "^(what|how|why|when|where|which|who|is|are|do|does|can|should|explain|define|describe|compare|list|difference|tell)\\b");

    public static boolean isDesignQuestion(Question q) {
        String text = q.getQuestion() == null || q.getQuestion().isBlank() ? q.getTitle() : q.getQuestion();
        if (!"hld".equals(q.getTech()) || text == null) return false;
        String t = text.trim().toLowerCase(Locale.ROOT);
        // "Design …" titles, plus full system write-ups titled like "SIP Stock Allocation System — HLD + LLD".
        return t.startsWith("design")
                || (NAMED_SYSTEM.matcher(t).find() && !QUESTION_START.matcher(t).find() && !t.contains("system design"));
    }

    public static String textOf(Question q) {
        return q.getQuestion() == null || q.getQuestion().isBlank() ? q.getTitle() : q.getQuestion();
    }

    /** The rubric to score against, creating and storing one on first use. */
    public Rubric rubricFor(Question q) {
        Rubric stored = parse(q.getRubric());
        if (stored != null) return stored;
        Rubric fresh = RubricDrafter.draft(q.getAnswer());
        save(q, fresh);
        return fresh;
    }

    /** Admin: replace the stored rubric (marked manual), or reset to the hand-written/auto version when null. */
    public Rubric replace(Question q, Rubric rubric) {
        Rubric next = rubric != null ? new Rubric("manual", rubric.stages()) : RubricDrafter.draft(q.getAnswer());
        save(q, next);
        return next;
    }

    public Rubric parse(String text) {
        if (text == null || text.isBlank()) return null;
        try { return json.readValue(text, new TypeReference<Rubric>() {}); } catch (Exception e) { return null; }
    }

    private void save(Question q, Rubric r) {
        try {
            String text = json.writeValueAsString(r);
            questions.updateRubric(q.getId(), text);
            q.setRubric(text);
        } catch (Exception e) {
            log.warn("Could not store the rubric for {}", q.getId(), e);
        }
    }

    /**
     * Admin import of hand-written rubric additions ({questionId: {stageKey: [[concept, term, term…]]}}): each becomes
     * the standard stages plus those concepts, stored on the question as a manual rubric. Questions that already have a
     * rubric keep it unless {@code overwrite} is set, so Admin edits win. Returns how many were stored and skipped.
     */
    public Map<String, Object> importHandWritten(JsonNode root, boolean overwrite) {
        int stored = 0, kept = 0;
        List<String> unknown = new ArrayList<>();
        for (Iterator<Map.Entry<String, JsonNode>> it = root.fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            if (e.getKey().startsWith("_")) continue;
            Question q = questions.findById(e.getKey()).orElse(null);
            if (q == null) { unknown.add(e.getKey()); continue; }
            if (!overwrite && q.getRubric() != null && !q.getRubric().isBlank()) { kept++; continue; }
            save(q, fromHandWritten(e.getValue()));
            stored++;
        }
        return Map.of("stored", stored, "kept", kept, "unknown", unknown);
    }

    // Standard stages with the question's hand-written concepts added to each stage.
    private static Rubric fromHandWritten(JsonNode byStage) {
        List<Rubric.Stage> stages = new ArrayList<>();
        for (Rubric.Stage s : RubricDrafter.standardStages()) {
            List<Rubric.Concept> all = new ArrayList<>(s.concepts());
            for (JsonNode c : byStage.path(s.key())) {
                List<String> parts = new ArrayList<>();
                c.forEach(p -> parts.add(p.asText()));
                if (parts.size() >= 2) all.add(new Rubric.Concept(parts.get(0), parts.subList(1, parts.size())));
            }
            stages.add(new Rubric.Stage(s.key(), s.label(), s.weight(), all));
        }
        return new Rubric("manual", stages);
    }
}
