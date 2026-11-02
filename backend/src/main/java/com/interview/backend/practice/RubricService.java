package com.interview.backend.practice;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;

/**
 * Rubrics for solo system design practice. A question's rubric is, in order of preference: the one stored on the
 * question (hand-written, seeded, or edited in Admin), else the hand-written additions for it, else an auto-draft from
 * its model answer. Whatever is used first is stored, so a question's scoring doesn't drift between attempts.
 */
@Slf4j
@Service
public class RubricService implements CommandLineRunner {

    private final QuestionRepository questions;
    private final ObjectMapper json = new ObjectMapper();
    /** questionId -> stage key -> extra concepts, from design-rubrics.json. */
    private final Map<String, Map<String, List<Rubric.Concept>>> handWritten = new HashMap<>();

    public RubricService(QuestionRepository questions) {
        this.questions = questions;
        try (InputStream in = new ClassPathResource("design-rubrics.json").getInputStream()) {
            JsonNode root = json.readTree(in);
            root.fields().forEachRemaining(e -> {
                if (e.getKey().startsWith("_")) return;
                Map<String, List<Rubric.Concept>> byStage = new HashMap<>();
                e.getValue().fields().forEachRemaining(st -> {
                    if (!st.getValue().isArray()) return;   // skips "title"
                    List<Rubric.Concept> concepts = new ArrayList<>();
                    for (JsonNode c : st.getValue()) {
                        List<String> parts = new ArrayList<>();
                        c.forEach(p -> parts.add(p.asText()));
                        if (parts.size() >= 2) concepts.add(new Rubric.Concept(parts.get(0), parts.subList(1, parts.size())));
                    }
                    byStage.put(st.getKey(), concepts);
                });
                handWritten.put(e.getKey(), byStage);
            });
        } catch (Exception e) {
            log.warn("design-rubrics.json could not be read; every design question will use an auto-drafted rubric", e);
        }
    }

    /** "Design …" questions in the HLD topic are the ones that can be practised. */
    public static boolean isDesignQuestion(Question q) {
        String text = q.getQuestion() == null || q.getQuestion().isBlank() ? q.getTitle() : q.getQuestion();
        return "hld".equals(q.getTech()) && text != null && text.trim().toLowerCase(Locale.ROOT).startsWith("design");
    }

    public static String textOf(Question q) {
        return q.getQuestion() == null || q.getQuestion().isBlank() ? q.getTitle() : q.getQuestion();
    }

    /** The rubric to score against, creating and storing one on first use. */
    public Rubric rubricFor(Question q) {
        Rubric stored = parse(q.getRubric());
        if (stored != null) return stored;
        Rubric fresh = handWritten.containsKey(q.getId()) ? fromHandWritten(q.getId()) : RubricDrafter.draft(q.getAnswer());
        save(q, fresh);
        return fresh;
    }

    /** Admin: replace the stored rubric (marked manual), or reset to the hand-written/auto version when null. */
    public Rubric replace(Question q, Rubric rubric) {
        Rubric next = rubric != null ? new Rubric("manual", rubric.stages())
                : handWritten.containsKey(q.getId()) ? fromHandWritten(q.getId()) : RubricDrafter.draft(q.getAnswer());
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

    // Standard stages with the question's hand-written concepts added to each stage.
    private Rubric fromHandWritten(String questionId) {
        Map<String, List<Rubric.Concept>> extra = handWritten.get(questionId);
        List<Rubric.Stage> stages = new ArrayList<>();
        for (Rubric.Stage s : RubricDrafter.standardStages()) {
            List<Rubric.Concept> all = new ArrayList<>(s.concepts());
            all.addAll(extra.getOrDefault(s.key(), List.of()));
            stages.add(new Rubric.Stage(s.key(), s.label(), s.weight(), all));
        }
        return new Rubric("manual", stages);
    }

    /** On startup: store the hand-written rubrics on their questions, unless a rubric is already there (Admin edits win). */
    @Override
    public void run(String... args) {
        int seeded = 0;
        for (String id : handWritten.keySet()) {
            Question q = questions.findById(id).orElse(null);
            if (q == null || (q.getRubric() != null && !q.getRubric().isBlank())) continue;
            save(q, fromHandWritten(id));
            seeded++;
        }
        if (seeded > 0) log.info("Seeded {} hand-written system design rubrics", seeded);
    }
}
