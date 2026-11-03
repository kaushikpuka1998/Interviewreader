package com.interview.backend.controller;

import com.interview.backend.entity.CommentReport;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.QuestionComment;
import com.interview.backend.entity.User;
import com.interview.backend.repository.CommentReportRepository;
import com.interview.backend.repository.QuestionCommentRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Comments under each question. Anyone can read; signed-in members can write (5 an hour, no more than 2 links),
 * delete their own, and report others. A comment reported by 3 different members is hidden until an admin looks.
 */
@RestController
@RequiredArgsConstructor
public class CommentController {

    static final int HIDE_AT_REPORTS = 3, PER_HOUR = 5, MAX_LEN = 2000;

    public record CommentRequest(String body) {}

    private final QuestionCommentRepository comments;
    private final CommentReportRepository reports;
    private final QuestionRepository questions;
    private final UserRepository users;

    private User me() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) return null;
        return users.findByEmail(auth.getName()).orElse(null);
    }

    private static boolean isAdmin() {
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    private Map<String, Object> view(QuestionComment c, Map<Long, User> authors, Long meId, boolean admin) {
        User a = authors.get(c.getUserId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("author", a == null ? "Member" : (a.getName() == null || a.getName().isBlank() ? a.getUsername() : a.getName()));
        m.put("username", a == null ? "" : a.getUsername());
        m.put("body", c.getBody());
        m.put("createdAt", c.getCreatedAt().toString());
        m.put("mine", meId != null && meId.equals(c.getUserId()));
        if (admin) { m.put("status", c.getStatus()); m.put("reports", c.getReports()); m.put("questionId", c.getQuestionId()); }
        return m;
    }

    private Map<Long, User> authorsOf(Collection<QuestionComment> list) {
        Map<Long, User> out = new HashMap<>();
        users.findAllById(list.stream().map(QuestionComment::getUserId).distinct().toList()).forEach(u -> out.put(u.getId(), u));
        return out;
    }

    @GetMapping("/questions/{id}/comments")
    public List<Map<String, Object>> list(@PathVariable String id) {
        List<QuestionComment> list = comments.findByQuestionIdAndStatusOrderByCreatedAtAsc(id, QuestionComment.VISIBLE);
        User u = me();
        Map<Long, User> authors = authorsOf(list);
        return list.stream().map(c -> view(c, authors, u == null ? null : u.getId(), false)).toList();
    }

    @PostMapping("/questions/{id}/comments")
    public ResponseEntity<?> add(@PathVariable String id, @RequestBody CommentRequest req) {
        User u = me();
        if (u == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to comment"));
        String body = req.body() == null ? "" : req.body().trim();
        if (body.length() < 3) return ResponseEntity.badRequest().body(Map.of("error", "Write a few words first."));
        if (body.length() > MAX_LEN) return ResponseEntity.badRequest().body(Map.of("error", "Comments can be up to " + MAX_LEN + " characters."));
        if (body.split("https?://", -1).length - 1 > 2) return ResponseEntity.badRequest().body(Map.of("error", "Please keep it to two links at most."));
        if (!questions.existsById(id)) return ResponseEntity.notFound().build();
        if (comments.countByUserIdAndCreatedAtAfter(u.getId(), Instant.now().minus(1, ChronoUnit.HOURS)) >= PER_HOUR)
            return ResponseEntity.status(429).body(Map.of("error", "You're posting quickly. Please try again in a while."));
        QuestionComment c = new QuestionComment();
        c.setQuestionId(id);
        c.setUserId(u.getId());
        c.setBody(body);
        comments.save(c);
        return ResponseEntity.ok(view(c, Map.of(u.getId(), u), u.getId(), false));
    }

    @DeleteMapping("/questions/{id}/comments/{cid}")
    public ResponseEntity<?> delete(@PathVariable String id, @PathVariable Long cid) {
        User u = me();
        QuestionComment c = comments.findById(cid).orElse(null);
        if (c == null || !c.getQuestionId().equals(id)) return ResponseEntity.notFound().build();
        if (u == null || (!u.getId().equals(c.getUserId()) && !isAdmin())) return ResponseEntity.status(403).body(Map.of("error", "Not your comment"));
        comments.delete(c);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/comments/{cid}/report")
    public ResponseEntity<?> report(@PathVariable Long cid) {
        User u = me();
        if (u == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to report"));
        QuestionComment c = comments.findById(cid).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        if (c.getUserId().equals(u.getId())) return ResponseEntity.badRequest().body(Map.of("error", "That's your own comment."));
        if (reports.existsByCommentIdAndUserId(cid, u.getId())) return ResponseEntity.ok(Map.of("ok", true));   // already reported
        CommentReport r = new CommentReport();
        r.setCommentId(cid);
        r.setUserId(u.getId());
        reports.save(r);
        c.setReports(c.getReports() + 1);
        if (c.getReports() >= HIDE_AT_REPORTS) c.setStatus(QuestionComment.HIDDEN);
        comments.save(c);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ---------- admin (/admin/** is admin-only) ----------

    @GetMapping("/admin/comments")
    public Map<String, Object> adminList(@RequestParam(defaultValue = "reported") String filter) {
        List<QuestionComment> list = "all".equals(filter)
                ? comments.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 100))
                : comments.findByReportsGreaterThanOrderByCreatedAtDesc(0, PageRequest.of(0, 100));
        Map<Long, User> authors = authorsOf(list);
        Map<String, String> titles = new HashMap<>();
        questions.findAllById(list.stream().map(QuestionComment::getQuestionId).distinct().toList()).forEach((Question q) -> titles.put(q.getId(), q.getTitle()));
        List<Map<String, Object>> rows = list.stream().map(c -> {
            Map<String, Object> m = view(c, authors, null, true);
            m.put("questionTitle", titles.getOrDefault(c.getQuestionId(), ""));
            return m;
        }).toList();
        return Map.of("comments", rows, "reportedPending", list.stream().filter(c -> c.getReports() > 0 && QuestionComment.VISIBLE.equals(c.getStatus())).count());
    }

    @PostMapping("/admin/comments/{cid}/{action}")
    public ResponseEntity<?> adminAct(@PathVariable Long cid, @PathVariable String action) {
        QuestionComment c = comments.findById(cid).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        switch (action) {
            case "hide" -> c.setStatus(QuestionComment.HIDDEN);
            case "show" -> { c.setStatus(QuestionComment.VISIBLE); c.setReports(0); }   // approved: clears the reports
            default -> { return ResponseEntity.badRequest().body(Map.of("error", "Unknown action")); }
        }
        comments.save(c);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/admin/comments/{cid}")
    public ResponseEntity<?> adminDelete(@PathVariable Long cid) {
        if (!comments.existsById(cid)) return ResponseEntity.notFound().build();
        comments.deleteById(cid);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Count for the admin tab badge. */
    @GetMapping("/admin/comments/counts")
    public Map<String, Object> counts() {
        return Map.of("pending", comments.findByReportsGreaterThanOrderByCreatedAtDesc(0, PageRequest.of(0, 500)).stream()
                .filter(c -> QuestionComment.VISIBLE.equals(c.getStatus()) || c.getReports() >= HIDE_AT_REPORTS).count());
    }
}
