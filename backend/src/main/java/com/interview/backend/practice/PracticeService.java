package com.interview.backend.practice;

import com.interview.backend.entity.DesignAttempt;
import com.interview.backend.entity.User;
import com.interview.backend.repository.DesignAttemptRepository;
import com.interview.backend.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Who may take another scored attempt: 3 free per member (lifetime), then the monthly plan allowance. Admins unlimited. */
@Service
@RequiredArgsConstructor
public class PracticeService {

    public static final int FREE_ATTEMPTS = 3;

    private final DesignAttemptRepository attempts;
    private final BillingService billing;

    /** Thrown when the member has no attempts left; the controller answers 402 with the quota. */
    public static class OutOfAttempts extends RuntimeException {
        public OutOfAttempts() { super("You've used all your attempts. Choose a plan to keep practising."); }
    }

    public Map<String, Object> quota(User u) {
        Map<String, Object> q = new LinkedHashMap<>();
        boolean admin = billing.isAdmin(u);
        long freeUsed = attempts.countByUserIdAndSource(u.getId(), DesignAttempt.FREE);
        String plan = billing.activePracticePlan(u);
        int allowance = plan == null ? 0 : BillingService.PRACTICE_ALLOWANCE.get(plan);
        long planUsed = plan == null ? 0 : attempts.countByUserIdAndSourceAndCreatedAtGreaterThanEqual(u.getId(), DesignAttempt.PLAN, u.getPracticePeriodStart());
        long freeLeft = Math.max(0, FREE_ATTEMPTS - freeUsed);
        long planLeft = Math.max(0, allowance - planUsed);
        q.put("unlimited", admin);
        q.put("freeTotal", FREE_ATTEMPTS);
        q.put("freeLeft", freeLeft);
        q.put("plan", plan);
        q.put("planAttempts", allowance);
        q.put("planUsed", planUsed);
        q.put("planLeft", planLeft);
        q.put("periodEnd", plan == null ? null : u.getPracticePeriodEnd());
        q.put("status", u.getPracticeStatus());
        q.put("canAttempt", admin || freeLeft > 0 || planLeft > 0);
        q.put("plans", billing.practicePlans());
        return q;
    }

    /** Which allowance pays for the next attempt: free ones first, then the plan. */
    public String chargeNextAttempt(User u) {
        if (billing.isAdmin(u)) return DesignAttempt.ADMIN;
        if (attempts.countByUserIdAndSource(u.getId(), DesignAttempt.FREE) < FREE_ATTEMPTS) return DesignAttempt.FREE;
        String plan = billing.activePracticePlan(u);
        if (plan != null && attempts.countByUserIdAndSourceAndCreatedAtGreaterThanEqual(u.getId(), DesignAttempt.PLAN, u.getPracticePeriodStart())
                < BillingService.PRACTICE_ALLOWANCE.get(plan)) return DesignAttempt.PLAN;
        throw new OutOfAttempts();
    }
}
