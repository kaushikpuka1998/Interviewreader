package com.interview.backend.practice;

import com.interview.backend.entity.DesignAttempt;
import com.interview.backend.entity.User;
import com.interview.backend.repository.DesignAttemptRepository;
import com.interview.backend.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Who may take another scored system-design question: 3 free per member, then Premium access is required. */
@Service
@RequiredArgsConstructor
public class PracticeService {

    public static final int FREE_ATTEMPTS = 3;

    private final DesignAttemptRepository attempts;
    private final BillingService billing;

    /** Thrown when the member has no attempts left; the controller answers 402 with the quota. */
    public static class OutOfAttempts extends RuntimeException {
        public OutOfAttempts() { super("You've used your 3 free system-design questions. Upgrade to Premium to keep practising."); }
    }

    public Map<String, Object> quota(User u) {
        Map<String, Object> q = new LinkedHashMap<>();
        boolean admin = billing.isAdmin(u);
        boolean premium = billing.isPremium(u);
        long freeUsed = attempts.countByUserIdAndSource(u.getId(), DesignAttempt.FREE);
        long freeLeft = Math.max(0, FREE_ATTEMPTS - freeUsed);
        q.put("unlimited", admin);
        q.put("premium", premium);
        q.put("freeTotal", FREE_ATTEMPTS);
        q.put("freeLeft", freeLeft);
        q.put("plan", null);
        q.put("planAttempts", 0);
        q.put("planUsed", 0);
        q.put("planLeft", 0);
        q.put("periodEnd", null);
        q.put("status", u.getPracticeStatus());
        q.put("canAttempt", admin || premium || freeLeft > 0);
        q.put("plans", java.util.List.of());
        return q;
    }

    /** Record whether a free question, Premium access, or admin access covers this answer. */
    public String chargeNextAttempt(User u) {
        if (billing.isAdmin(u)) return DesignAttempt.ADMIN;
        if (attempts.countByUserIdAndSource(u.getId(), DesignAttempt.FREE) < FREE_ATTEMPTS) return DesignAttempt.FREE;
        if (billing.isPremium(u)) return DesignAttempt.PREMIUM;
        throw new OutOfAttempts();
    }
}
