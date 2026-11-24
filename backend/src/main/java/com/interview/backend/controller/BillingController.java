package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Context-path is /api, so this maps to /api/billing/*. Everything but the webhook and plan prices needs a signed-in member.
@RestController
@RequestMapping("/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billing;
    private final UserRepository users;
    private final com.interview.backend.repository.PaymentAttemptRepository payments;

    private User currentUser() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return billing.status(currentUser());
    }

    /** Premium pass prices for the plan picker. Public, so the top bar can show it before sign-in. */
    @GetMapping("/plans")
    public Object plans(@RequestParam(required = false) String currency) {
        User u = null;
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) u = users.findByEmail(auth.getName()).orElse(null);
        } catch (Exception ignored) { /* anonymous visitors just see the standard passes */ }
        return billing.premiumPlans(u, currency);
    }

    public record PlanInput(String plan, String coupon, String currency) {}

    public record CouponCheck(String plan, String code, String currency) {}

    /** "Have a coupon?": what the code would do to this pass. The same check runs again when the order is created. */
    @PostMapping("/coupon/validate")
    public ResponseEntity<?> validateCoupon(@RequestBody CouponCheck in) {
        try {
            return ResponseEntity.ok(billing.quoteCoupon(currentUser(), in == null ? null : in.plan(), in == null ? null : in.code(), in == null ? null : in.currency()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Premium one-time pass: monthly / yearly / lifetime.
    @PostMapping("/premium/order")
    public ResponseEntity<?> premiumOrder(@RequestBody PlanInput in) {
        User u = currentUser();
        String plan = in == null ? null : in.plan();
        try {
            Map<String, Object> order = billing.createPremiumOrder(u, plan, in == null ? null : in.coupon(), in == null ? null : in.currency());
            attempt(u, plan, order.get("amount") instanceof Number n ? n.intValue() / 100 : null, String.valueOf(order.get("currency")), String.valueOf(order.get("orderId")), com.interview.backend.entity.PaymentAttempt.STARTED, null);
            return ResponseEntity.ok(order);
        } catch (IllegalArgumentException e) {
            attempt(u, plan, null, null, null, com.interview.backend.entity.PaymentAttempt.FAILED, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            attempt(u, plan, null, null, null, com.interview.backend.entity.PaymentAttempt.FAILED, e.getMessage());
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            attempt(u, plan, null, null, null, com.interview.backend.entity.PaymentAttempt.FAILED, "Order could not be created: " + e.getMessage());
            throw e;   // still a 500, which the server-error log and the admin alert pick up
        }
    }

    /** Checkout the member opened and walked away from (still STARTED after 5 minutes, not asked yet): the app then asks why. */
    @GetMapping("/abandoned")
    public Map<String, Object> abandoned() {
        User u = currentUser();
        var now = java.time.Instant.now();
        // Skip members who really bought a pass (or when everything is free). Admins count as Premium for access, but without a
        // purchase they are still asked, so the question can be tried with an admin account.
        if (billing.isEverythingFree() || (u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(now))) return Map.of();
        return payments.findByUserIdAndStatusAndAskedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(u.getId(), "STARTED", now.minus(14, java.time.temporal.ChronoUnit.DAYS)).stream()
                .filter(a -> a.getCreatedAt().isBefore(now.minus(5, java.time.temporal.ChronoUnit.MINUTES)))
                .findFirst()
                .<Map<String, Object>>map(a -> Map.of("id", a.getId(), "plan", a.getPlan() == null ? "" : a.getPlan(), "amount", a.getAmount() == null ? 0 : a.getAmount()))
                .orElse(Map.of());
    }

    public record ReasonInput(String reason) {}

    /** The answer (or a dismissal with an empty reason). Closes every open unasked checkout for the member so they are asked once. */
    @PostMapping("/abandoned/reason")
    public ResponseEntity<?> abandonedReason(@RequestBody ReasonInput in) {
        User u = currentUser();
        String reason = in == null || in.reason() == null ? "" : in.reason().trim();
        if (reason.length() > 700) reason = reason.substring(0, 700);
        var open = payments.findByUserIdAndStatusAndAskedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(u.getId(), "STARTED", java.time.Instant.EPOCH);
        for (int i = 0; i < open.size(); i++) {
            open.get(i).setAskedAt(java.time.Instant.now());
            if (i == 0 && !reason.isEmpty()) open.get(i).setReason(reason);
        }
        payments.saveAll(open);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Remembers a checkout attempt for the admin's payments list. Never lets bookkeeping break a payment. */
    private void attempt(User u, String plan, Integer amount, String currency, String orderId, String status, String error) {
        try {
            var a = new com.interview.backend.entity.PaymentAttempt();
            a.setUserId(u.getId()); a.setEmail(u.getEmail()); a.setPlan(plan); a.setAmount(amount); a.setCurrency(currency);
            a.setOrderId(orderId); a.setStatus(status);
            a.setError(error == null ? null : (error.length() > 300 ? error.substring(0, 300) : error));
            payments.save(a);
        } catch (Exception ignored) { /* bookkeeping only */ }
    }

    public record OrderVerifyRequest(String razorpay_payment_id, String razorpay_order_id, String razorpay_signature) {}

    @PostMapping("/premium/verify")
    public ResponseEntity<?> verifyPremium(@RequestBody OrderVerifyRequest req) {
        User u = currentUser();
        if (!billing.verifyPremiumOrder(u, req.razorpay_payment_id(), req.razorpay_order_id(), req.razorpay_signature()))
            return ResponseEntity.badRequest().body(Map.of("error", "Payment could not be verified."));
        return ResponseEntity.ok(billing.status(u));
    }

    public record VerifyRequest(String razorpay_payment_id, String razorpay_subscription_id, String razorpay_signature) {}

    // Cancels the older recurring Premium subscription (members who subscribed before the one-time passes).
    @PostMapping("/cancel")
    public ResponseEntity<?> cancel() {
        User u = currentUser();
        try {
            billing.cancel(u);
            return ResponseEntity.ok(billing.status(u));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Razorpay server-to-server events. Public; trust comes from the X-Razorpay-Signature HMAC. */
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestBody String raw,
                                     @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        return billing.handleWebhook(raw, signature)
                ? ResponseEntity.ok(Map.of("ok", true))
                : ResponseEntity.badRequest().body(Map.of("error", "Invalid signature"));
    }

    // ---- Peer mock interview plans (5 / 10 interviews a month), separate from Premium ----

    @PostMapping("/interviews/subscribe")
    public ResponseEntity<?> subscribeInterview(@RequestBody PlanInput in) {
        try {
            return ResponseEntity.ok(billing.subscribeInterview(currentUser(), in == null ? null : in.plan(), in == null ? null : in.currency()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/interviews/verify")
    public ResponseEntity<?> verifyInterview(@RequestBody VerifyRequest req) {
        User u = currentUser();
        if (!billing.verifyInterview(u, req.razorpay_payment_id(), req.razorpay_subscription_id(), req.razorpay_signature()))
            return ResponseEntity.badRequest().body(Map.of("error", "Payment could not be verified."));
        return ResponseEntity.ok(Map.of("plan", u.getInterviewPlan(), "status", u.getInterviewStatus()));
    }

    @PostMapping("/interviews/cancel")
    public ResponseEntity<?> cancelInterview() {
        User u = currentUser();
        try {
            billing.cancelInterview(u);
            return ResponseEntity.ok(Map.of("plan", u.getInterviewPlan(), "status", u.getInterviewStatus()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- System design practice plans (12 / 18 / 24 attempts a month), separate from Premium ----

    @PostMapping("/practice/subscribe")
    public ResponseEntity<?> subscribePractice(@RequestBody PlanInput in) {
        try {
            return ResponseEntity.ok(billing.subscribePractice(currentUser(), in == null ? null : in.plan(), in == null ? null : in.currency()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/practice/verify")
    public ResponseEntity<?> verifyPractice(@RequestBody VerifyRequest req) {
        User u = currentUser();
        if (!billing.verifyPractice(u, req.razorpay_payment_id(), req.razorpay_subscription_id(), req.razorpay_signature()))
            return ResponseEntity.badRequest().body(Map.of("error", "Payment could not be verified."));
        return ResponseEntity.ok(Map.of("plan", u.getPracticePlan(), "status", u.getPracticeStatus()));
    }

    @PostMapping("/practice/cancel")
    public ResponseEntity<?> cancelPractice() {
        User u = currentUser();
        try {
            billing.cancelPractice(u);
            return ResponseEntity.ok(Map.of("plan", u.getPracticePlan(), "status", u.getPracticeStatus()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
