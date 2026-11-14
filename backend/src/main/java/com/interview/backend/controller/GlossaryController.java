package com.interview.backend.controller;

import com.interview.backend.entity.GlossaryTerm;
import com.interview.backend.repository.GlossaryTermRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hover glossary. GET /glossary is public; writes live under /admin/** (admin-only in SecurityConfig). */
@RestController
public class GlossaryController {

    private final GlossaryTermRepository terms;

    public GlossaryController(GlossaryTermRepository terms) {
        this.terms = terms;
    }

    @GetMapping("/glossary")
    public ResponseEntity<List<Map<String, Object>>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic()).body(rows());
    }

    private List<Map<String, Object>> rows() {
        return terms.findAll().stream()
                .sorted((a, b) -> a.getTerm().compareTo(b.getTerm()))
                .map(t -> Map.<String, Object>of(
                        "id", t.getId(), "term", t.getTerm(), "definition", t.getDefinition(),
                        "example", t.getExample() == null ? "" : t.getExample()))
                .toList();
    }

    /** Create, or update when the term already exists. */
    @PostMapping("/admin/glossary")
    public ResponseEntity<?> save(@RequestBody Map<String, String> body) {
        String term = clean(body.get("term")).toLowerCase();
        String def = clean(body.get("definition"));
        String eg = clean(body.get("example"));
        if (term.isEmpty() || term.length() > 80) return bad("Term is required (max 80 characters).");
        if (def.isEmpty() || def.length() > 800) return bad("Definition is required (max 800 characters).");
        if (eg.length() > 400) return bad("Example is max 400 characters.");
        GlossaryTerm t = terms.findByTerm(term).orElseGet(GlossaryTerm::new);
        t.setTerm(term);
        t.setDefinition(def);
        t.setExample(eg.isEmpty() ? null : eg);
        t.setUpdatedAt(Instant.now());
        terms.save(t);
        return ResponseEntity.ok(rows());
    }

    @DeleteMapping("/admin/glossary/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        terms.deleteById(id);
        return ResponseEntity.ok(rows());
    }

    private static String clean(String s) {
        return s == null ? "" : s.replace("||", "|").trim();
    }

    private static ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
