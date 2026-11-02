package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.MockInterviewRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Who may book another peer (real person) mock interview, as the candidate. Interviewers never pay.
 * Free for everyone until the launch period ends; then Premium includes a few a month (calendar month, IST),
 * and monthly plans add 5 or 10 per billing period. Premium's allowance is used before the plan's. Admins unlimited.
 */
@Service
public class InterviewAccessService {

    public static final String FREE = "free", PREMIUM = "premium", PLAN = "plan", ADMIN = "admin";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final MockInterviewRepository interviews;
    private final BillingService billing;
    private final Instant freeUntil;
    private final int premiumMonthly;

    public InterviewAccessService(MockInterviewRepository interviews, BillingService billing,
                                  @Value("${app.interviews.free-until:2026-11-15T23:59:59+05:30}") String freeUntil,
                                  @Value("${app.interviews.premium-monthly:6}") int premiumMonthly) {
        this.interviews = interviews;
        this.billing = billing;
        this.freeUntil = OffsetDateTime.parse(freeUntil).toInstant();
        this.premiumMonthly = premiumMonthly;
    }

    /** Thrown when the candidate has no interviews left; the controller answers 402 with the quota. */
    public static class OutOfInterviews extends RuntimeException {
        public OutOfInterviews() { super("You've used all your mock interviews. Get Premium or choose a monthly plan to book more."); }
    }

    public boolean freePeriod() { return Instant.now().isBefore(freeUntil); }

    static Instant monthStart() {
        return ZonedDateTime.now(IST).withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS).toInstant();
    }

    public Map<String, Object> quota(User u) {
        boolean admin = billing.isAdmin(u), free = freePeriod(), premium = billing.isPremium(u) && !admin;
        long premiumUsed = premium ? interviews.countUsed(u.getId(), PREMIUM, monthStart()) : 0;
        String plan = billing.activeInterviewPlan(u);
        int allowance = plan == null ? 0 : BillingService.INTERVIEW_ALLOWANCE.get(plan);
        long planUsed = plan == null ? 0 : interviews.countUsed(u.getId(), PLAN, u.getInterviewPeriodStart());
        long premiumLeft = premium ? Math.max(0, premiumMonthly - premiumUsed) : 0, planLeft = Math.max(0, allowance - planUsed);
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("unlimited", admin);
        q.put("freePeriod", free);
        q.put("freeUntil", freeUntil.toString());
        q.put("premium", premium);
        q.put("premiumMonthly", premiumMonthly);
        q.put("premiumLeft", premiumLeft);
        q.put("premiumResets", ZonedDateTime.now(IST).withDayOfMonth(1).plusMonths(1).truncatedTo(ChronoUnit.DAYS).toInstant().toString());
        q.put("plan", plan);
        q.put("planInterviews", allowance);
        q.put("planLeft", planLeft);
        q.put("periodEnd", plan == null ? null : u.getInterviewPeriodEnd());
        q.put("status", u.getInterviewStatus());
        q.put("canRequest", admin || free || premiumLeft > 0 || planLeft > 0);
        q.put("plans", billing.interviewPlans());
        return q;
    }

    /** Which allowance pays for a new booking: free period, then Premium's monthly ones, then the plan. */
    public String charge(User u) {
        if (billing.isAdmin(u)) return ADMIN;
        if (freePeriod()) return FREE;
        if (billing.isPremium(u) && interviews.countUsed(u.getId(), PREMIUM, monthStart()) < premiumMonthly) return PREMIUM;
        String plan = billing.activeInterviewPlan(u);
        if (plan != null && interviews.countUsed(u.getId(), PLAN, u.getInterviewPeriodStart()) < BillingService.INTERVIEW_ALLOWANCE.get(plan)) return PLAN;
        throw new OutOfInterviews();
    }
}
