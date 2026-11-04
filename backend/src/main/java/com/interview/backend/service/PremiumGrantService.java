package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Free Premium time (3-day trial, referral rewards). Time stacks on whatever is running, a lifetime pass is never
 * touched, and the "given by" marker is set only when the member had no Premium: paid time can't be revoked by
 * mistake, and an admin can still see where free time came from.
 */
@Service
@RequiredArgsConstructor
public class PremiumGrantService {

    private static final Instant LIFETIME_FLOOR = Instant.parse("2900-01-01T00:00:00Z");

    private final UserRepository users;
    private final BillingService billing;

    public void grantDays(User u, int days, String source) {
        Instant now = Instant.now();
        boolean active = u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(now);
        if (active && u.getPremiumUntil().isAfter(LIFETIME_FLOOR)) return;
        Instant base = active ? u.getPremiumUntil() : now;
        u.setPremiumUntil(base.plus(Duration.ofDays(days)));
        if (!active) {
            u.setPremiumPlan(null);
            u.setPremiumGrantedBy(source);
        }
        users.save(u);
        billing.forgetPremium(u.getEmail());
    }
}
