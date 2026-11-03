package com.interview.backend.controller;

import com.interview.backend.entity.Feedback;
import com.interview.backend.repository.FeedbackRepository;
import com.interview.backend.service.ImageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Feedback from the home page form, with optional screenshots. Sending is open to everyone; reading is admin-only (/admin/**). */
@RestController
public class FeedbackController {

    public record FeedbackInput(Integer rating, String message, String email, List<String> imageUrls, String page,
                                Map<String, List<String>> answers) {}

    /**
     * The option questions on the feedback page and the answers each accepts (same keys and values as the page,
     * FeedbackPage.jsx). Anything else is rejected, so the admin summary only ever counts real options.
     */
    static final Map<String, Set<String>> QUESTIONS = Map.of(
            "theme", Set.of("green", "pink", "either"),
            "issues", Set.of("none", "slow", "broken", "account", "payment", "mobile", "content", "other"),
            "platforms", Set.of("leetcode", "gfg", "interviewbit", "scaler", "educative", "youtube", "chatgpt", "none"),
            "wishlist", Set.of("problems", "video", "ai_interview", "company_sets", "discussion", "certificates", "mobile_app", "contests", "other"));
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();

    private static final int MAX_IMAGES = 3;
    // SVG is left out on purpose: anonymous visitors can upload here, and an SVG can carry scripts.
    private static final Set<String> IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/gif", "image/webp");

    private final FeedbackRepository feedback;
    private final ImageService images;
    private final com.interview.backend.repository.UserRepository users;
    private final com.interview.backend.repository.UserProgressRepository progress;
    private final com.interview.backend.repository.CodeSubmissionRepository submissions;
    private final com.interview.backend.repository.PageViewRepository pageViews;
    private final com.interview.backend.service.PointsService points;
    private final com.interview.backend.service.BillingService billing;

    public FeedbackController(FeedbackRepository feedback, ImageService images, com.interview.backend.repository.UserRepository users,
                              com.interview.backend.repository.UserProgressRepository progress,
                              com.interview.backend.repository.CodeSubmissionRepository submissions,
                              com.interview.backend.repository.PageViewRepository pageViews,
                              com.interview.backend.service.PointsService points, com.interview.backend.service.BillingService billing) {
        this.feedback = feedback;
        this.images = images;
        this.users = users;
        this.progress = progress;
        this.submissions = submissions;
        this.pageViews = pageViews;
        this.points = points;
        this.billing = billing;
    }

    /** A screenshot for a feedback message. Returns { "url": "..." }. */
    @PostMapping(value = "/feedback/image", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        if (file.getContentType() == null || !IMAGE_TYPES.contains(file.getContentType()))
            return ResponseEntity.badRequest().body(Map.of("error", "Please attach a PNG, JPG, GIF or WebP image."));
        try {
            return ResponseEntity.ok(Map.of("url", images.upload(file)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }
    }

    @PostMapping("/feedback")
    public ResponseEntity<?> send(@RequestBody FeedbackInput in, Principal principal) {
        String message = in.message() == null ? "" : in.message().trim();
        Map<String, List<String>> answers = new java.util.TreeMap<>();
        if (in.answers() != null) {
            for (var e : in.answers().entrySet()) {
                Set<String> allowed = QUESTIONS.get(e.getKey());
                List<String> picked = e.getValue() == null ? List.of() : e.getValue().stream().distinct().toList();
                if (allowed == null || !allowed.containsAll(picked) || picked.size() > allowed.size())
                    return ResponseEntity.badRequest().body(Map.of("error", "Unknown answer."));
                if (!picked.isEmpty()) answers.put(e.getKey(), picked);
            }
        }
        // The option questions count as feedback on their own; otherwise a few words are needed.
        if (answers.isEmpty() && message.length() < 5) return ResponseEntity.badRequest().body(Map.of("error", "Please pick an answer or write a few words of feedback."));
        if (message.length() > 2000) return ResponseEntity.badRequest().body(Map.of("error", "Feedback is too long (max 2000 characters)."));
        if (in.rating() != null && (in.rating() < 1 || in.rating() > 5)) return ResponseEntity.badRequest().body(Map.of("error", "Rating must be 1 to 5."));
        List<String> urls = new ArrayList<>();
        if (in.imageUrls() != null) {
            for (String u : in.imageUrls()) {
                if (u == null || u.length() > 400 || !u.contains("/api/images/file/images/") || u.contains(" ") || u.contains("\n"))
                    return ResponseEntity.badRequest().body(Map.of("error", "Invalid screenshot."));
                urls.add(u);
            }
            if (urls.size() > MAX_IMAGES) return ResponseEntity.badRequest().body(Map.of("error", "Attach at most " + MAX_IMAGES + " screenshots."));
        }
        Feedback f = new Feedback();
        f.setMessage(message);
        f.setRating(in.rating());
        // A signed-in sender is identified by their account; the email is never taken from the request.
        // A signed-out sender must give an email so the team can reply.
        if (principal != null && principal.getName() != null) {
            f.setEmail(principal.getName());
            f.setFromAccount(true);
        } else {
            String email = in.email() == null ? "" : in.email().trim();
            if (email.isEmpty() || email.length() > 200 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
                return ResponseEntity.badRequest().body(Map.of("error", "Please enter a valid email so we can reply."));
            f.setEmail(email);
        }
        f.setImageUrls(urls.isEmpty() ? null : String.join("\n", urls));
        String page = in.page() == null ? "" : in.page().trim();
        f.setPage(page.isEmpty() ? null : page.substring(0, Math.min(300, page.length())));
        try {
            f.setAnswers(answers.isEmpty() ? null : JSON.writeValueAsString(answers));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unknown answer."));
        }
        feedback.save(f);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Admin: who sent a feedback response (account, activity, recent pages), to follow up or reproduce an issue. */
    @GetMapping("/admin/feedback/{id}/sender")
    public ResponseEntity<?> sender(@PathVariable Long id) {
        Feedback f = feedback.findById(id).orElse(null);
        if (f == null) return ResponseEntity.notFound().build();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("email", f.getEmail());
        out.put("feedbackCount", f.getEmail() == null ? 0 : feedback.countByEmail(f.getEmail()));
        var u = f.getEmail() == null ? null : users.findByEmail(f.getEmail().toLowerCase()).orElse(null);
        out.put("member", u != null);
        if (u == null) return ResponseEntity.ok(out);   // a visitor without an account: only the email is known
        out.put("name", u.getName() == null ? "" : u.getName());
        out.put("username", u.getUsername() == null ? "" : u.getUsername());
        out.put("joined", u.getCreatedAt());
        out.put("lastLogin", u.getLastLoginAt());
        out.put("location", u.getCountry() == null ? "" : (u.getCity() == null ? "" : u.getCity() + ", ") + u.getCountry());
        out.put("premium", billing.isPremium(u));
        out.put("premiumUntil", u.getPremiumUntil());
        var rows = progress.findByUserId(u.getId());
        out.put("questionsRead", rows.stream().filter(r -> r.isRead()).count());
        out.put("questionsVisited", rows.stream().filter(r -> r.isVisited()).count());
        out.put("codingSolved", submissions.findByUserEmailAndStatus(u.getEmail(), "Accepted").stream().map(x -> x.getProblemId()).distinct().count());
        Map<String, Object> p = points.summary(u);
        out.put("streak", p.get("streak"));
        out.put("bestStreak", p.get("best"));
        out.put("totalPoints", p.get("totalPoints"));
        out.put("league", p.get("league"));
        out.put("recentPages", pageViews.findTop15ByUserIdOrderByCreatedAtDesc(u.getId()).stream()
                .map(v -> Map.of("path", v.getPath(), "device", v.getDevice() == null ? "" : v.getDevice(), "at", v.getCreatedAt())).toList());
        return ResponseEntity.ok(out);
    }

    @GetMapping("/admin/feedback")
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Feedback f : feedback.findAllByOrderByCreatedAtDesc()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", f.getId());
            row.put("rating", f.getRating());
            row.put("message", f.getMessage());
            row.put("email", f.getEmail());
            row.put("fromAccount", Boolean.TRUE.equals(f.getFromAccount()));
            row.put("page", f.getPage());
            row.put("imageUrls", f.getImageUrls() == null ? List.of() : List.of(f.getImageUrls().split("\n")));
            row.put("answers", readAnswers(f.getAnswers()));
            row.put("createdAt", f.getCreatedAt());
            out.add(row);
        }
        return out;
    }

    @DeleteMapping("/admin/feedback/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!feedback.existsById(id)) return ResponseEntity.notFound().build();
        feedback.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static Map<String, Object> readAnswers(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return JSON.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
