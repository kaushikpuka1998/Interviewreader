package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin: give a member Premium without payment (1 month, 1 year or lifetime), or take an admin grant back.
 * Paid Premium is never touched here: a member with paid time can't be granted over, and only admin grants
 * can be revoked (paying clears the grant marker, so later payments are safe too). Admin-only via /admin/**.
 */
@RestController
@RequestMapping("/admin/premium")
@RequiredArgsConstructor
public class AdminPremiumController {

    private static final Map<String, Duration> LENGTHS = Map.of("monthly", Duration.ofDays(31), "yearly", Duration.ofDays(365));
    private static final Instant LIFETIME = Instant.parse("2999-12-31T00:00:00Z");   // same "never ends" as a paid lifetime pass

    private final UserRepository users;
    private final com.interview.backend.service.BillingService billing;

    /** Members matching q (email, name or username); with no q, everyone who has Premium now. */
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String q) {
        String term = q.trim();
        List<User> found = term.isEmpty()
                ? users.findByPremiumUntilAfterOrderByPremiumUntilDesc(Instant.now())
                : users.searchMembers(term, PageRequest.of(0, 20));
        return found.stream().map(AdminPremiumController::row).toList();
    }

    public record GrantRequest(String plan) {}

    @PostMapping("/{userId}")
    public ResponseEntity<?> grant(@PathVariable Long userId, @RequestBody GrantRequest req, Principal admin) {
        String plan = req == null ? null : req.plan();
        if (!"lifetime".equals(plan) && !LENGTHS.containsKey(plan))
            return ResponseEntity.badRequest().body(Map.of("error", "Choose monthly, yearly or lifetime"));
        User u = users.findById(userId).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        Instant now = Instant.now();
        boolean active = u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(now);
        if (active && u.getPremiumGrantedBy() == null)
            return ResponseEntity.status(409).body(Map.of("error", "This member already has paid Premium until " + u.getPremiumUntil()));
        // An admin grant on top of an earlier admin grant extends it; lifetime is never shortened.
        Instant base = active ? u.getPremiumUntil() : now;
        Instant until = "lifetime".equals(plan) ? LIFETIME : base.plus(LENGTHS.get(plan));
        if (u.getPremiumUntil() == null || u.getPremiumUntil().isBefore(until)) u.setPremiumUntil(until);
        if (!"lifetime".equals(u.getPremiumPlan()) || !active) u.setPremiumPlan(plan);
        u.setPremiumGrantedBy(admin.getName());
        User saved = users.save(u);
        billing.forgetPremium(saved.getEmail());
        return ResponseEntity.ok(row(saved));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> revoke(@PathVariable Long userId) {
        User u = users.findById(userId).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        if (u.getPremiumGrantedBy() == null)
            return ResponseEntity.status(409).body(Map.of("error", "Only Premium given by an admin can be revoked here"));
        u.setPremiumUntil(null);
        u.setPremiumPlan(null);
        u.setPremiumGrantedBy(null);
        User saved = users.save(u);
        billing.forgetPremium(saved.getEmail());
        return ResponseEntity.ok(row(saved));
    }

    private static Map<String, Object> row(User u) {
        boolean active = u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(Instant.now());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("email", u.getEmail());
        m.put("name", u.getName() == null ? "" : u.getName());
        m.put("username", u.getUsername() == null ? "" : u.getUsername());
        m.put("premium", active);
        m.put("premiumUntil", active ? u.getPremiumUntil().toString() : "");
        m.put("lifetime", active && u.getPremiumUntil().isAfter(Instant.parse("2900-01-01T00:00:00Z")));
        m.put("plan", u.getPremiumPlan() == null ? "" : u.getPremiumPlan());
        m.put("grantedBy", u.getPremiumGrantedBy() == null ? "" : u.getPremiumGrantedBy());
        return m;
    }
}
