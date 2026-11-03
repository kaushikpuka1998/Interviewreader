package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Spaced revision: a question you read (or flagged) comes back after 3, 7, 16, 35 and then 70 days, so it
 * sticks. "Revise today" lists what is due, oldest first (at most 10 at a time); "Done" moves it to the next gap.
 */
@RestController
@RequestMapping("/revision")
@RequiredArgsConstructor
public class RevisionController {

    static final int[] GAP_DAYS = {3, 7, 16, 35, 70};
    private static final int LIMIT = 10;

    private final UserProgressRepository progress;
    private final QuestionRepository questions;
    private final UserRepository users;

    private Long meId() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow().getId();
    }

    /** When this row is due, or null when it isn't part of revision (not read and not flagged). */
    static Instant dueAt(UserProgress p) {
        if (!p.isRead() && !p.isFlagged()) return null;
        int stage = Math.min(p.getRevisionStage() == null ? 0 : p.getRevisionStage(), GAP_DAYS.length - 1);
        Instant base = p.getRevisedAt() != null ? p.getRevisedAt() : p.getReadAt() != null ? p.getReadAt() : Instant.EPOCH;   // read before dates were kept: due now
        return base.plus(Duration.ofDays(GAP_DAYS[stage]));
    }

    @GetMapping("/due")
    public Map<String, Object> due() {
        Instant now = Instant.now();
        List<UserProgress> due = new ArrayList<>();
        for (UserProgress p : progress.findByUserId(meId())) {
            Instant d = dueAt(p);
            if (d != null && !d.isAfter(now)) due.add(p);
        }
        due.sort(Comparator.comparing(RevisionController::dueAt));
        List<UserProgress> shown = due.subList(0, Math.min(LIMIT, due.size()));
        Map<String, Question> byId = new HashMap<>();
        questions.findAllById(shown.stream().map(UserProgress::getQuestionId).toList()).forEach(q -> byId.put(q.getId(), q));
        List<Map<String, Object>> items = new ArrayList<>();
        for (UserProgress p : shown) {
            Question q = byId.get(p.getQuestionId());
            if (q == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("title", q.getTitle());
            m.put("tech", q.getTech());
            m.put("flagged", p.isFlagged());
            m.put("round", (p.getRevisionStage() == null ? 0 : p.getRevisionStage()) + 1);
            items.add(m);
        }
        return Map.of("total", due.size(), "items", items);
    }

    @PostMapping("/{questionId}/done")
    public ResponseEntity<?> done(@PathVariable String questionId) {
        UserProgress p = progress.findByUserIdAndQuestionId(meId(), questionId).orElse(null);
        if (p == null || dueAt(p) == null) return ResponseEntity.notFound().build();
        p.setRevisedAt(Instant.now());
        p.setRevisionStage(Math.min((p.getRevisionStage() == null ? 0 : p.getRevisionStage()) + 1, GAP_DAYS.length - 1));
        progress.save(p);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
