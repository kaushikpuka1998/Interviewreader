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
    private static final Map<String, Boolean> DEFAULTS = Map.ofEntries(
            Map.entry("resume_promo", true),
            Map.entry("resume_builder", true),
            Map.entry("code_practice", true),
            Map.entry("code_practice_promo", true),
            Map.entry("daily_promo", true),
            // The mock interview feature, and a "New" badge on its top-bar link.
            Map.entry("mock_interview", true),
            Map.entry("new_badge_interview", false),
            // When on, any member can interview candidates; when off only admins can (see MockInterviewController).
            Map.entry("interviewer_open", false),
            // A "New" badge on the matching top-bar links; off until an admin announces something.
            Map.entry("new_badge_resume_builder", false),
            Map.entry("new_badge_code_practice", false),
            // When on, every signed-in member gets all Premium features free (see BillingService.isPremium).
            Map.entry("premium_free", false),
            // A global visitor-facing status notice for maintenance or a known service issue.
            Map.entry("site_notice", false));

    private final FeatureFlagRepository flags;

    public FeatureFlagController(FeatureFlagRepository flags) {
        this.flags = flags;
    }

    @GetMapping("/features")
    public ResponseEntity<Map<String, Boolean>> allCached() {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofSeconds(60)).cachePublic()).body(all());
    }

    private Map<String, Boolean> all() {
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
