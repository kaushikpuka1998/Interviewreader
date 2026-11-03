package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.PremiumGrantService;
import com.interview.backend.service.ReferralService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** The member's referral link and progress, and the one-time 3-day Premium trial. Signed-in members only. */
@RestController
@RequiredArgsConstructor
public class ReferralController {

    static final int TRIAL_DAYS = 3;

    private final UserRepository users;
    private final ReferralService referrals;
    private final PremiumGrantService grants;
    private final com.interview.backend.service.BillingService billing;

    @Value("${app.frontend.url:https://interviewreader.cloud}")
    private String site;

    private User me() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    @GetMapping("/referral/me")
    public Map<String, Object> referral() {
        User u = me();
        String code = referrals.codeFor(u);
        long joined = users.countByReferredBy(u.getId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("link", site.replaceAll("/+$", "") + "/?ref=" + code);
        m.put("joined", joined);
        m.put("daysEarned", Math.min(joined, ReferralService.MAX_REWARDS) * ReferralService.REWARD_DAYS);
        m.put("rewardDays", ReferralService.REWARD_DAYS);
        m.put("maxRewards", ReferralService.MAX_REWARDS);
        return m;
    }

    @GetMapping("/billing/trial")
    public Map<String, Object> trialStatus() {
        User u = me();
        return Map.of("available", u.getTrialUsedAt() == null && !billing.isPremium(u), "days", TRIAL_DAYS, "used", u.getTrialUsedAt() != null);
    }

    @PostMapping("/billing/trial")
    public ResponseEntity<?> startTrial() {
        User u = me();
        if (u.getTrialUsedAt() != null) return ResponseEntity.status(409).body(Map.of("error", "You've already used your free trial."));
        if (billing.isPremium(u)) return ResponseEntity.status(409).body(Map.of("error", "You already have Premium."));
        u.setTrialUsedAt(Instant.now());
        grants.grantDays(u, TRIAL_DAYS, "trial");
        return ResponseEntity.ok(Map.of("ok", true, "premiumUntil", u.getPremiumUntil().toString()));
    }
}
