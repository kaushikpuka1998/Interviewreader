package com.interview.backend.controller;

import com.interview.backend.entity.FeatureFlag;
import com.interview.backend.repository.FeatureFlagRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Feature flags. GET /features is public so the frontend can read them; PUT /admin/features/{key}
 * is admin-only through the /admin/** rule in SecurityConfig.
 */
@RestController
public class FeatureFlagController {

    // Known flags and their defaults when no row has been saved yet.
    private static final Map<String, Boolean> DEFAULTS = Map.of(
            "resume_promo", true,
            "resume_builder", true,
            "code_practice", true,
            "code_practice_promo", true,
            "daily_promo", true,
            // The mock interview feature, and a "New" badge on its top-bar link.
            "mock_interview", true,
            "new_badge_interview", false,
            // When on, any member can interview candidates; when off only admins can (see MockInterviewController).
            "interviewer_open", false,
            // A "New" badge on the matching top-bar links; off until an admin announces something.
            "new_badge_resume_builder", false,
            "new_badge_code_practice", false);

    private final FeatureFlagRepository flags;

    public FeatureFlagController(FeatureFlagRepository flags) {
        this.flags = flags;
    }

    @GetMapping("/features")
    public Map<String, Boolean> all() {
        Map<String, Boolean> out = new LinkedHashMap<>(DEFAULTS);
        flags.findAll().forEach(f -> {
            if (DEFAULTS.containsKey(f.getKey())) out.put(f.getKey(), f.isEnabled());
        });
        return out;
    }

    @PutMapping("/admin/features/{key}")
    public ResponseEntity<?> update(@PathVariable String key, @RequestBody Map<String, Object> body) {
        if (!DEFAULTS.containsKey(key)) return ResponseEntity.notFound().build();
        if (!(body.get("enabled") instanceof Boolean enabled)) {
            return ResponseEntity.badRequest().body(Map.of("error", "enabled must be true or false"));
        }
        FeatureFlag flag = flags.findById(key).orElseGet(FeatureFlag::new);
        flag.setKey(key);
        flag.setEnabled(enabled);
        flag.setUpdatedAt(Instant.now());
        flags.save(flag);
        return ResponseEntity.ok(all());
    }
}
