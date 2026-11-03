package com.interview.backend.controller;

import com.interview.backend.entity.AnswerVote;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.repository.AnswerVoteRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * "Was this answer helpful?" on every question. One vote per member (or per visitor session), changeable.
 * The admin view ranks questions by how many readers said no, so the weakest answers get fixed first.
 */
@RestController
@RequiredArgsConstructor
public class AnswerFeedbackController {

    public record VoteRequest(Boolean helpful, String sessionId, String note) {}

    private final AnswerVoteRepository votes;
    private final QuestionRepository questions;
    private final UserRepository users;

    private String voter(String sessionId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            Optional<User> u = users.findByEmail(auth.getName());
            if (u.isPresent()) return "u:" + u.get().getId();
        }
        return sessionId == null || sessionId.isBlank() || sessionId.length() > 64 ? null : "s:" + sessionId;
    }

    private Map<String, Object> state(String questionId, String voter) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("helpful", votes.countHelpful(questionId));
        m.put("notHelpful", votes.countNotHelpful(questionId));
        m.put("mine", voter == null ? null : votes.findByQuestionIdAndVoter(questionId, voter).map(AnswerVote::isHelpful).orElse(null));
        return m;
    }

    @GetMapping("/questions/{id}/helpful")
    public Map<String, Object> get(@PathVariable String id, @RequestParam(required = false) String sessionId) {
        return state(id, voter(sessionId));
    }

    @PostMapping("/questions/{id}/helpful")
    public ResponseEntity<?> vote(@PathVariable String id, @RequestBody VoteRequest req) {
        String voter = voter(req.sessionId());
        if (voter == null || req.helpful() == null) return ResponseEntity.badRequest().body(Map.of("error", "Missing vote"));
        if (!questions.existsById(id)) return ResponseEntity.notFound().build();
        AnswerVote v = votes.findByQuestionIdAndVoter(id, voter).orElseGet(AnswerVote::new);
        v.setQuestionId(id);
        v.setVoter(voter);
        v.setHelpful(req.helpful());
        String note = req.note() == null ? "" : req.note().trim();
        v.setNote(req.helpful() || note.isEmpty() ? null : note.substring(0, Math.min(300, note.length())));
        v.setCreatedAt(java.time.Instant.now());
        votes.save(v);
        return ResponseEntity.ok(state(id, voter));
    }

    /** Admin: questions with the most "not helpful" votes first, with the notes readers left. */
    @GetMapping("/admin/answer-feedback")
    public Map<String, Object> admin() {
        List<Object[]> totals = votes.totals();
        Map<String, Question> byId = new HashMap<>();
        questions.findAllById(totals.stream().map(r -> (String) r[0]).toList()).forEach(q -> byId.put(q.getId(), q));
        List<Map<String, Object>> rows = new ArrayList<>();
        long yes = 0, no = 0;
        for (Object[] r : totals) {
            long h = ((Number) r[1]).longValue(), n = ((Number) r[2]).longValue();
            yes += h; no += n;
            Question q = byId.get((String) r[0]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r[0]);
            m.put("title", q == null ? "(deleted)" : q.getTitle());
            m.put("tech", q == null ? "" : q.getTech());
            m.put("helpful", h);
            m.put("notHelpful", n);
            rows.add(m);
        }
        rows.sort(Comparator.comparingLong((Map<String, Object> m) -> -(Long) m.get("notHelpful")).thenComparingLong(m -> -(Long) m.get("helpful")));
        List<Map<String, Object>> notes = votes.findTop200ByHelpfulFalseAndNoteIsNotNullOrderByCreatedAtDesc().stream()
                .map(v -> Map.<String, Object>of("questionId", v.getQuestionId(), "note", v.getNote(), "at", v.getCreatedAt().toString())).toList();
        return Map.of("helpful", yes, "notHelpful", no, "questions", rows, "notes", notes);
    }
}
