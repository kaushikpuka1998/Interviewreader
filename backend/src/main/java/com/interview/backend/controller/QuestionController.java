package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.service.AccessService;
import com.interview.backend.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/questions")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:3000"})
public class QuestionController {

    private final QuestionService questionService;
    private final AccessService access;

    /**
     * Public index of every question: id, URL slug, tech and last change. No answers, so gated topics stay gated;
     * it lets slug-only links (sitemap, canonical URLs, shares) resolve to the right question, and feeds the sitemap.
     */
    @GetMapping("/index")
    public ResponseEntity<List<Map<String, String>>> index() {
        List<Map<String, String>> out = questionService.indexRows().stream().map(r -> {
            String text = r[1] != null && !((String) r[1]).isBlank() ? (String) r[1] : (String) r[2];
            Object changed = r[4] != null ? r[4] : r[5];
            return Map.of(
                    "id", (String) r[0],
                    "slug", slugify(text),
                    "tech", (String) r[3],
                    "lastmod", changed == null ? "" : changed.toString().substring(0, 10));
        }).toList();
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofMinutes(10)).cachePublic())
                .body(out);
    }

    // Must match frontend/src/lib/slug.js exactly, or slug links won't resolve.
    static String slugify(String text) {
        String s = (text == null ? "" : text).toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return s.length() > 80 ? s.substring(0, 80) : s;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getQuestion(@PathVariable String id) {
        return questionService.getById(id)
                .<ResponseEntity<?>>map(q -> access.canRead(q.getTech())
                        ? ResponseEntity.ok(q)
                        : ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                                "error", "signup_required",
                                "message", "Create a free account to read " + q.getTech() + " questions",
                                "tech", q.getTech())))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<?> searchQuestions(
            @RequestParam(required = false) String tech,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) List<String> visitedIds,
            @RequestParam(required = false) List<String> readIds,
            @RequestParam(required = false) List<String> flaggedIds,
            @RequestParam(required = false) List<String> importantIds,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "sortKey") String sort,
            @RequestParam(defaultValue = "asc") String direction) {

        Sort.Direction sortDirection = direction.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDirection, sort));

        boolean restrict = access.isRestricted();
        if (restrict && tech != null && !access.canRead(tech)) {
            // Asking for a locked topic while signed out: say so explicitly so the
            // UI can prompt for sign-up instead of silently showing nothing.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "signup_required",
                    "message", "Create a free account to browse " + tech + " questions",
                    "tech", tech));
        }

        // The filter accepts either the display name or the slug; normalise to the slug.
        String companySlug = (company == null || company.isBlank())
                ? null : com.interview.backend.entity.Company.toSlug(company);

        Page<Question> result = questionService.searchQuestions(
                restrict, access.allowedTechs(), tech, category, difficulty, companySlug, search, status, visitedIds, readIds, flaggedIds, importantIds, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories(@RequestParam String tech) {
        if (!access.canRead(tech)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "signup_required",
                    "message", "Create a free account to browse " + tech + " questions",
                    "tech", tech));
        }
        return ResponseEntity.ok(questionService.getCategoriesByTech(tech));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(Map.of(
                // Topics readable without an account — the UI locks the rest.
                "freeTechs", access.freeTechs(),
                "authenticated", access.isAuthenticated(),
                "total", questionService.getTotalCount(),
                "byTech", questionService.getAllTechCounts()
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    // --- Admin-only: create questions (secured to ROLE_ADMIN in SecurityConfig) ---

    @PostMapping
    public ResponseEntity<?> createQuestion(@RequestBody com.interview.backend.dto.QuestionInput input) {
        try {
            List<Question> saved = questionService.createFromInputs(List.of(input));
            return ResponseEntity.status(201).body(saved.get(0));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> createBulk(@RequestBody List<com.interview.backend.dto.QuestionInput> inputs) {
        if (inputs == null || inputs.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "No questions provided"));
        try {
            return ResponseEntity.ok(questionService.upsertFromInputs(inputs));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuestion(@PathVariable String id,
                                            @RequestBody com.interview.backend.dto.QuestionInput input) {
        try {
            return ResponseEntity.ok(questionService.update(id, input));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteQuestion(@PathVariable String id) {
        try {
            questionService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
