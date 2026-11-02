package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.practice.DesignScorer;
import com.interview.backend.practice.Rubric;
import com.interview.backend.practice.RubricService;
import com.interview.backend.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Admin (/api/admin/**, ROLE_ADMIN): review and edit the system design practice rubrics, and try them on a sample answer. */
@RestController
@RequestMapping("/admin/design-rubrics")
@RequiredArgsConstructor
public class DesignRubricAdminController {

    private final QuestionRepository questions;
    private final RubricService rubrics;
    private final com.interview.backend.practice.InterviewBanks banks;

    public record TestInput(String answer) {}

    /** Import the voice interviewer's banks from a private JSON file ({questionId: bank}); replaces each question's bank. */
    @PostMapping("/import/banks")
    public Map<String, Object> importBanks(@RequestBody com.fasterxml.jackson.databind.JsonNode body) {
        return banks.importBanks(body);
    }

    /** Import hand-written rubric additions ({questionId: {stage: [[concept, terms…]]}}); existing rubrics kept unless overwrite. */
    @PostMapping("/import/rubrics")
    public Map<String, Object> importRubrics(@RequestBody com.fasterxml.jackson.databind.JsonNode body, @RequestParam(defaultValue = "false") boolean overwrite) {
        return rubrics.importHandWritten(body, overwrite);
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String q) {
        String needle = q.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Question question : questions.findByTech("hld")) {
            if (!RubricService.isDesignQuestion(question)) continue;
            String title = RubricService.textOf(question);
            if (!needle.isEmpty() && !title.toLowerCase(Locale.ROOT).contains(needle) && !question.getId().contains(needle)) continue;
            Rubric r = rubrics.parse(question.getRubric());
            out.add(Map.of("id", question.getId(), "title", title, "source", r == null ? "none" : r.source()));
        }
        return out;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", q.getId(), "title", RubricService.textOf(q), "rubric", rubrics.rubricFor(q)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> save(@PathVariable String id, @RequestBody Rubric rubric) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        String error = validate(rubric);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("error", error));
        return ResponseEntity.ok(Map.of("id", id, "rubric", rubrics.replace(q, rubric)));
    }

    /** Throw away edits: back to the hand-written rubric, or a fresh auto-draft from the model answer. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> reset(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", id, "rubric", rubrics.replace(q, null)));
    }

    /** Score a sample answer against the stored rubric without using anyone's attempts. */
    @PostMapping("/{id}/test")
    public ResponseEntity<?> test(@PathVariable String id, @RequestBody TestInput in) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(DesignScorer.score(rubrics.rubricFor(q), in == null || in.answer() == null ? "" : in.answer()));
    }

    private static String validate(Rubric r) {
        if (r == null || r.stages() == null || r.stages().isEmpty()) return "A rubric needs at least one stage.";
        for (Rubric.Stage s : r.stages()) {
            if (s.label() == null || s.label().isBlank() || s.key() == null || s.key().isBlank()) return "Every stage needs a name.";
            if (s.weight() <= 0 || s.weight() > 10) return "Stage weights must be between 0 and 10.";
            if (s.concepts() == null || s.concepts().isEmpty()) return "Stage \"" + s.label() + "\" needs at least one concept.";
            for (Rubric.Concept c : s.concepts())
                if (c.name() == null || c.name().isBlank() || c.terms() == null || c.terms().stream().allMatch(t -> t == null || t.isBlank()))
                    return "Every concept needs a name and at least one term.";
        }
        return null;
    }
}
