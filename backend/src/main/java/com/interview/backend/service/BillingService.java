package com.interview.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Premium = a one-time pass (monthly / yearly / lifetime, paid as a Razorpay order; admins are always premium).
 * Members from the older recurring Premium subscription keep renewing through the webhook until they cancel.
 * System design practice plans are separate monthly subscriptions.
 * Talks to the Razorpay REST API directly; no SDK needed for the few calls we make.
 */
@Slf4j
@Service
public class BillingService {

    private static final String API = "https://api.razorpay.com/v1";
    // Access window granted on a verified payment until the webhook reports the real period end.
    private static final Duration FIRST_PERIOD = Duration.ofDays(31);
    // Small grace after a period ends so a renewal charge arriving a little late doesn't lock the member out.
    private static final Duration GRACE = Duration.ofDays(1);

    private final UserRepository users;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Set<String> adminEmails;
    private final String keyId, keySecret, webhookSecret;

    /** Premium passes: how long each grants (null = lifetime). */
    public static final Map<String, Duration> PREMIUM_LENGTH = Map.of("monthly", Duration.ofDays(31), "yearly", Duration.ofDays(365));
    private static final List<String> PREMIUM_PLANS = List.of("monthly", "yearly", "lifetime");
    // Lifetime = an end date nobody reaches.
    private static final Instant LIFETIME = Instant.parse("2999-12-31T00:00:00Z");
    private final Map<String, Integer> premiumPrices;   // rupees
    private final Map<String, Integer> premiumRegular;  // rupees, shown crossed out; 0 = none
    private final Map<String, String> practiceRegularLabels;

    /** System design practice plans: monthly attempt allowance per tier, each its own Razorpay plan. */
    public static final Map<String, Integer> PRACTICE_ALLOWANCE = Map.of("p12", 12, "p18", 18, "p24", 24);
    private final Map<String, String> practicePlanIds;
    private final Map<String, String> practicePriceLabels;

    /** Peer mock interview plans: monthly interview allowance per tier, each its own Razorpay plan. */
    public static final Map<String, Integer> INTERVIEW_ALLOWANCE = Map.of("i5", 5, "i10", 10);
    private final Map<String, String> interviewPlanIds;
    private final Map<String, String> interviewPriceLabels;
    private final Map<String, String> interviewRegularLabels;   // crossed-out "was" price; blank = none

    // Coupons are optional extras on a Premium order, so this is injected after construction rather than widening the long constructor.
    @org.springframework.beans.factory.annotation.Autowired
    private CouponService coupons;
    @org.springframework.beans.factory.annotation.Autowired
    private com.interview.backend.repository.FeatureFlagRepository flags;

    // The "premium_free" feature flag (Admin → Feature flags): read on every Premium check, so cached for a few seconds.
    private volatile boolean allFree;
    private volatile long allFreeAt;

    public boolean isEverythingFree() {
        long now = System.currentTimeMillis();
        if (now - allFreeAt > 10_000) {
            allFree = flags != null && flags.findById("premium_free").map(com.interview.backend.entity.FeatureFlag::isEnabled).orElse(false);
            allFreeAt = now;
        }
        return allFree;
    }

    public BillingService(UserRepository users,
                          @Value("${app.admin.emails:}") String adminEmailsCsv,
                          @Value("${app.razorpay.key-id:}") String keyId,
                          @Value("${app.razorpay.key-secret:}") String keySecret,
                          @Value("${app.razorpay.webhook-secret:}") String webhookSecret,
                          @Value("${app.premium.price-monthly:2200}") int priceMonthly,
                          @Value("${app.premium.price-yearly:6500}") int priceYearly,
                          @Value("${app.premium.price-lifetime:14000}") int priceLifetime,
                          @Value("${app.premium.regular-monthly:0}") int regularMonthly,
                          @Value("${app.premium.regular-yearly:0}") int regularYearly,
                          @Value("${app.premium.regular-lifetime:0}") int regularLifetime,
                          @Value("${app.practice.regular-label-12:}") String practiceRegular12,
                          @Value("${app.practice.regular-label-18:}") String practiceRegular18,
                          @Value("${app.practice.regular-label-24:}") String practiceRegular24,
                          @Value("${app.razorpay.practice-plan-12:}") String practicePlan12,
                          @Value("${app.razorpay.practice-plan-18:}") String practicePlan18,
                          @Value("${app.razorpay.practice-plan-24:}") String practicePlan24,
                          @Value("${app.practice.price-label-12:\u20B9499/month}") String practiceLabel12,
                          @Value("${app.practice.price-label-18:\u20B9699/month}") String practiceLabel18,
                          @Value("${app.practice.price-label-24:\u20B9999/month}") String practiceLabel24,
                          @Value("${app.razorpay.interview-plan-5:}") String interviewPlan5,
                          @Value("${app.razorpay.interview-plan-10:}") String interviewPlan10,
                          @Value("${app.interviews.price-label-5:\u20B9499/month}") String interviewLabel5,
                          @Value("${app.interviews.price-label-10:\u20B9799/month}") String interviewLabel10,
                          @Value("${app.interviews.regular-label-5:}") String interviewRegular5,
                          @Value("${app.interviews.regular-label-10:}") String interviewRegular10) {
        this.users = users;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(",")).map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
        this.premiumPrices = Map.of("monthly", priceMonthly, "yearly", priceYearly, "lifetime", priceLifetime);
        this.premiumRegular = Map.of("monthly", regularMonthly, "yearly", regularYearly, "lifetime", regularLifetime);
        this.practiceRegularLabels = Map.of("p12", practiceRegular12, "p18", practiceRegular18, "p24", practiceRegular24);
        this.practicePlanIds = Map.of("p12", practicePlan12, "p18", practicePlan18, "p24", practicePlan24);
        this.practicePriceLabels = Map.of("p12", practiceLabel12, "p18", practiceLabel18, "p24", practiceLabel24);
        this.interviewPlanIds = Map.of("i5", interviewPlan5, "i10", interviewPlan10);
        this.interviewPriceLabels = Map.of("i5", interviewLabel5, "i10", interviewLabel10);
        this.interviewRegularLabels = Map.of("i5", interviewRegular5, "i10", interviewRegular10);
    }

    public boolean isAdmin(User u) {
        return u != null && u.getEmail() != null && adminEmails.contains(u.getEmail().toLowerCase());
    }

    /** The practice plans for the plan picker, cheapest first. */
    public List<Map<String, Object>> practicePlans() {
        return List.of("p12", "p18", "p24").stream().map(k -> Map.<String, Object>of(
                "key", k, "attempts", PRACTICE_ALLOWANCE.get(k), "priceLabel", practicePriceLabels.get(k),
                "regularLabel", practiceRegularLabels.get(k), "available", !practicePlanIds.get(k).isBlank())).toList();
    }

    /** The member's active practice plan key, or null (no plan, or its paid period has ended). */
    public String activePracticePlan(User u) {
        return u.getPracticePlan() != null && u.getPracticePeriodEnd() != null && u.getPracticePeriodEnd().isAfter(Instant.now())
                ? u.getPracticePlan() : null;
    }

    /** Starts a Razorpay subscription for a practice plan; it becomes the member's plan once the payment is verified. */
    public Map<String, Object> subscribePractice(User u, String plan) {
        String id = practicePlanIds.get(plan);
        if (id == null) throw new IllegalArgumentException("Unknown plan.");
        requireConfigured(id, "RAZORPAY_PRACTICE_PLAN_" + plan.substring(1));
        JsonNode sub = call("POST", "/subscriptions", Map.of(
                "plan_id", id, "total_count", 120, "customer_notify", 1,
                "notes", Map.of("email", u.getEmail(), "product", "practice", "plan", plan)));
        u.setPracticePendingPlan(plan);
        u.setPracticePendingSubscriptionId(sub.path("id").asText());
        users.save(u);
        return Map.of("subscriptionId", u.getPracticePendingSubscriptionId(), "keyId", keyId,
                "priceLabel", practicePriceLabels.get(plan), "attempts", PRACTICE_ALLOWANCE.get(plan),
                "email", u.getEmail(), "name", u.getName() == null ? "" : u.getName());
    }

    /**
     * Checkout success for a practice plan. Switching tier cancels the previous practice subscription right away;
     * the new plan's allowance starts now (the webhook then sets the exact billing period from Razorpay).
     */
    public boolean verifyPractice(User u, String paymentId, String subscriptionId, String signature) {
        if (subscriptionId == null || !subscriptionId.equals(u.getPracticePendingSubscriptionId())) return false;
        if (!matches(hmac(paymentId + "|" + subscriptionId, keySecret), signature)) return false;
        String old = u.getPracticeSubscriptionId();
        if (old != null && !old.equals(subscriptionId) && !"cancelled".equals(u.getPracticeStatus())) {
            try { call("POST", "/subscriptions/" + old + "/cancel", Map.of("cancel_at_cycle_end", 0)); }
            catch (Exception e) { log.warn("Could not cancel the previous practice subscription {}", old, e); }
        }
        u.setPracticePlan(u.getPracticePendingPlan());
        u.setPracticeSubscriptionId(subscriptionId);
        u.setPracticeStatus("active");
        u.setPracticePeriodStart(Instant.now());
        u.setPracticePeriodEnd(Instant.now().plus(FIRST_PERIOD));
        u.setPracticePendingPlan(null);
        u.setPracticePendingSubscriptionId(null);
        users.save(u);
        return true;
    }

    /** Cancels the practice plan at the end of the cycle; the remaining attempts stay usable until then. */
    public void cancelPractice(User u) {
        if (u.getPracticeSubscriptionId() == null) throw new IllegalStateException("No practice plan to cancel.");
        call("POST", "/subscriptions/" + u.getPracticeSubscriptionId() + "/cancel", Map.of("cancel_at_cycle_end", 1));
        u.setPracticeStatus("cancelled");
        users.save(u);
    }

    // ---- Peer mock interview plans (5 / 10 a month), separate from Premium and practice ----

    public List<Map<String, Object>> interviewPlans() {
        return List.of("i5", "i10").stream().map(k -> Map.<String, Object>of(
                "key", k, "interviews", INTERVIEW_ALLOWANCE.get(k), "priceLabel", interviewPriceLabels.get(k),
                "regularLabel", interviewRegularLabels.get(k), "available", !interviewPlanIds.get(k).isBlank())).toList();
    }

    /** The member's active interview plan key, or null (no plan, or its paid period has ended). */
    public String activeInterviewPlan(User u) {
        return u.getInterviewPlan() != null && u.getInterviewPeriodEnd() != null && u.getInterviewPeriodEnd().isAfter(Instant.now())
                ? u.getInterviewPlan() : null;
    }

    public Map<String, Object> subscribeInterview(User u, String plan) {
        String id = interviewPlanIds.get(plan);
        if (id == null) throw new IllegalArgumentException("Unknown plan.");
        requireConfigured(id, "RAZORPAY_INTERVIEW_PLAN_" + plan.substring(1));
        JsonNode sub = call("POST", "/subscriptions", Map.of(
                "plan_id", id, "total_count", 120, "customer_notify", 1,
                "notes", Map.of("email", u.getEmail(), "product", "interviews", "plan", plan)));
        u.setInterviewPendingPlan(plan);
        u.setInterviewPendingSubscriptionId(sub.path("id").asText());
        users.save(u);
        return Map.of("subscriptionId", u.getInterviewPendingSubscriptionId(), "keyId", keyId,
                "priceLabel", interviewPriceLabels.get(plan), "interviews", INTERVIEW_ALLOWANCE.get(plan),
                "email", u.getEmail(), "name", u.getName() == null ? "" : u.getName());
    }

    /** Checkout success for an interview plan; switching tier cancels the previous one (same as practice plans). */
    public boolean verifyInterview(User u, String paymentId, String subscriptionId, String signature) {
        if (subscriptionId == null || !subscriptionId.equals(u.getInterviewPendingSubscriptionId())) return false;
        if (!matches(hmac(paymentId + "|" + subscriptionId, keySecret), signature)) return false;
        String old = u.getInterviewSubscriptionId();
        if (old != null && !old.equals(subscriptionId) && !"cancelled".equals(u.getInterviewStatus())) {
            try { call("POST", "/subscriptions/" + old + "/cancel", Map.of("cancel_at_cycle_end", 0)); }
            catch (Exception e) { log.warn("Could not cancel the previous interview subscription {}", old, e); }
        }
        u.setInterviewPlan(u.getInterviewPendingPlan());
        u.setInterviewSubscriptionId(subscriptionId);
        u.setInterviewStatus("active");
        u.setInterviewPeriodStart(Instant.now());
        u.setInterviewPeriodEnd(Instant.now().plus(FIRST_PERIOD));
        u.setInterviewPendingPlan(null);
        u.setInterviewPendingSubscriptionId(null);
        users.save(u);
        return true;
    }

    public void cancelInterview(User u) {
        if (u.getInterviewSubscriptionId() == null) throw new IllegalStateException("No interview plan to cancel.");
        call("POST", "/subscriptions/" + u.getInterviewSubscriptionId() + "/cancel", Map.of("cancel_at_cycle_end", 1));
        u.setInterviewStatus("cancelled");
        users.save(u);
    }

    private void requireConfigured(String planIdValue, String planEnv) {
        List<String> missing = new ArrayList<>();
        if (keyId.isBlank()) missing.add("RAZORPAY_KEY_ID");
        if (keySecret.isBlank()) missing.add("RAZORPAY_KEY_SECRET");
        if (planIdValue != null && planIdValue.isBlank()) missing.add(planEnv);   // null = no plan needed (one-time orders)
        if (!missing.isEmpty()) {
            log.warn("Checkout blocked: missing {}", missing);
            throw new IllegalStateException("Payments are not configured yet.");
        }
    }

    /** The Premium passes for the pricing cards: key and price in rupees. */
    public List<Map<String, Object>> premiumPlans() {
        return PREMIUM_PLANS.stream().map(k -> Map.<String, Object>of("key", k, "price", premiumPrices.get(k), "regular", premiumRegular.get(k))).toList();
    }

    public boolean isPremium(User u) {
        if (u == null) return false;
        if (isEverythingFree()) return true;   // the admin switched every Premium feature on for all signed-in members
        if (u.getEmail() != null && adminEmails.contains(u.getEmail().toLowerCase())) return true;
        return u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(Instant.now());
    }

    // Premium is asked on almost every request (question lists, details, banner). What is kept per member is the DATE their Premium ends
    // (0 = none), not a yes/no, so the answer stays correct as time passes and can be kept for an hour. A payment, grant, revoke or renewal
    // clears it (forgetPremium). It lives in the shared Redis cache so every backend instance agrees; if Redis is down it falls back to this
    // instance's memory for a short time. Admins and the "everything free" switch never need the cache.
    private record PremiumHit(long untilMs, long at) {}
    private final java.util.concurrent.ConcurrentHashMap<String, PremiumHit> premiumLocal = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long PREMIUM_LOCAL_MS = 15_000;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.cache.CacheManager cacheManager;

    private org.springframework.cache.Cache premiumCache() {
        try { return cacheManager == null ? null : cacheManager.getCache("premium"); } catch (RuntimeException e) { return null; }
    }

    /** Drop a member's remembered Premium end date, so a payment, grant or revoke shows on their very next request. */
    public void forgetPremium(String email) {
        if (email == null) return;
        premiumLocal.remove(email);
        var c = premiumCache();
        if (c != null) { try { c.evict(email); } catch (RuntimeException ignored) { /* Redis down: the expiry covers it */ } }
    }

    public boolean isPremium(String email) {
        if (email == null) return false;
        if (isEverythingFree()) return users.findByEmail(email).isPresent();
        if (adminEmails.contains(email.toLowerCase())) return true;
        long now = System.currentTimeMillis();
        var c = premiumCache();
        boolean redisUp = c != null;
        if (redisUp) {
            try { Long v = c.get(email, Long.class); if (v != null) return v > now; }
            catch (RuntimeException e) { redisUp = false; }
        }
        if (!redisUp) {
            PremiumHit hit = premiumLocal.get(email);
            if (hit != null && now - hit.at() < PREMIUM_LOCAL_MS) return hit.untilMs() > now;
        }
        long until = users.findByEmail(email).map(u -> u.getPremiumUntil() == null ? 0L : u.getPremiumUntil().toEpochMilli()).orElse(0L);
        if (redisUp) { try { c.put(email, until); } catch (RuntimeException ignored) { /* next call reads the row again */ } }
        else {
            if (premiumLocal.size() > 20_000) premiumLocal.clear();
            premiumLocal.put(email, new PremiumHit(until, now));
        }
        return until > now;
    }

    public Map<String, Object> status(User u) {
        return Map.of(
                "premium", isPremium(u),
                "premiumUntil", u.getPremiumUntil() == null ? "" : u.getPremiumUntil().toString(),
                "premiumPlan", u.getPremiumPlan() == null ? "" : u.getPremiumPlan(),
                "status", u.getSubscriptionStatus() == null ? "" : u.getSubscriptionStatus());
    }

    /** What a coupon would do to a pass, for the "Have a coupon?" box: valid or not, the reason, and the new price in rupees. */
    public Map<String, Object> quoteCoupon(User u, String plan, String code) {
        Integer price = premiumPrices.get(plan);
        if (price == null) throw new IllegalArgumentException("Unknown plan.");
        var q = coupons.quote(code, plan, price, u.getId());
        return Map.of("valid", q.valid(), "message", q.message(), "code", q.code() == null ? "" : q.code(),
                "price", price, "discount", q.discount(), "finalPrice", q.finalPrice());
    }

    /**
     * Creates a Razorpay order for a Premium pass. The amount is worked out here (config price, less a valid coupon), never taken
     * from the client. The coupon is remembered on the member and counted only once the payment is confirmed.
     */
    public Map<String, Object> createPremiumOrder(User u, String plan, String couponCode) {
        Integer price = premiumPrices.get(plan);
        if (price == null) throw new IllegalArgumentException("Unknown plan.");
        String applied = null;
        int pay = price;
        if (couponCode != null && !couponCode.isBlank()) {
            var q = coupons.quote(couponCode, plan, price, u.getId());
            if (!q.valid()) throw new IllegalArgumentException(q.message());
            applied = q.code();
            pay = q.finalPrice();
        }
        requireConfigured(null, null);
        Map<String, String> notes = new java.util.HashMap<>(Map.of("email", u.getEmail(), "product", "premium", "plan", plan));
        if (applied != null) notes.put("coupon", applied);
        JsonNode order = call("POST", "/orders", Map.of(
                "amount", pay * 100, "currency", "INR", "receipt", "premium-" + u.getId() + "-" + System.currentTimeMillis(), "notes", notes));
        u.setPremiumPendingPlan(plan);
        u.setPremiumPendingCoupon(applied);
        u.setPremiumPendingOrderId(order.path("id").asText());
        users.save(u);
        return Map.of("orderId", u.getPremiumPendingOrderId(), "keyId", keyId, "amount", pay * 100, "plan", plan,
                "email", u.getEmail(), "name", u.getName() == null ? "" : u.getName());
    }

    /** Checkout success for a Premium order: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
    public boolean verifyPremiumOrder(User u, String paymentId, String orderId, String signature) {
        if (orderId == null || !orderId.equals(u.getPremiumPendingOrderId())) return false;
        if (!matches(hmac(orderId + "|" + paymentId, keySecret), signature)) return false;
        grantPremium(u);
        return true;
    }

    /**
     * Grants the pending pass once (checkout handler or the order.paid webhook, whichever comes first).
     * Time stacks on top of any Premium still running; a lifetime pass is never shortened.
     */
    private void grantPremium(User u) {
        String plan = u.getPremiumPendingPlan();
        Instant now = Instant.now();
        Instant base = u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(now) ? u.getPremiumUntil() : now;
        Duration length = PREMIUM_LENGTH.get(plan);
        Instant until = length == null ? LIFETIME : base.plus(length);
        if (u.getPremiumUntil() == null || u.getPremiumUntil().isBefore(until)) u.setPremiumUntil(until);
        if (!"lifetime".equals(u.getPremiumPlan())) u.setPremiumPlan(plan);
        u.setPremiumGrantedBy(null);   // paid now, so an admin "revoke" must not take it away
        forgetPremium(u.getEmail());
        // Moving from the old recurring subscription to a pass: stop the renewals so they aren't charged twice.
        if (u.getRazorpaySubscriptionId() != null && "active".equals(u.getSubscriptionStatus())) {
            try {
                call("POST", "/subscriptions/" + u.getRazorpaySubscriptionId() + "/cancel", Map.of("cancel_at_cycle_end", 1));
                u.setSubscriptionStatus("cancelled");
            } catch (Exception e) { log.warn("Could not cancel the old Premium subscription {}", u.getRazorpaySubscriptionId(), e); }
        }
        u.setPremiumPendingPlan(null);
        u.setPremiumPendingOrderId(null);
        if (u.getPremiumPendingCoupon() != null) {
            coupons.redeem(u.getPremiumPendingCoupon(), u.getId());   // the payment went through: now the code counts as used
            u.setPremiumPendingCoupon(null);
        }
        users.save(u);
    }

    /** Cancels at the end of the current billing cycle; access stays until premiumUntil. */
    public void cancel(User u) {
        if (u.getRazorpaySubscriptionId() == null) throw new IllegalStateException("No active subscription.");
        call("POST", "/subscriptions/" + u.getRazorpaySubscriptionId() + "/cancel", Map.of("cancel_at_cycle_end", 1));
        u.setSubscriptionStatus("cancelled");
        users.save(u);
    }

    /** Razorpay webhook. Returns false when the signature is wrong (caller answers 400). */
    public boolean handleWebhook(String rawBody, String signature) {
        if (webhookSecret.isBlank() || !matches(hmac(rawBody, webhookSecret), signature)) return false;
        try {
            JsonNode root = json.readTree(rawBody);
            String event = root.path("event").asText();
            if ("order.paid".equals(event)) {
                // Backup for a Premium checkout whose browser closed before the handler ran.
                JsonNode order = root.path("payload").path("order").path("entity");
                String orderId = order.path("id").asText(""), email = order.path("notes").path("email").asText("");
                users.findByEmail(email).filter(u -> orderId.equals(u.getPremiumPendingOrderId())).ifPresent(this::grantPremium);
                return true;
            }
            JsonNode sub = root.path("payload").path("subscription").path("entity");
            String subId = sub.path("id").asText(null);
            if (subId == null) return true;   // not a subscription event; acknowledge and ignore
            var interview = users.findByInterviewSubscriptionId(subId);
            if (interview.isPresent()) {
                User u = interview.get();
                switch (event) {
                    case "subscription.activated", "subscription.charged", "subscription.resumed" -> {
                        long start = sub.path("current_start").asLong(0), end = sub.path("current_end").asLong(0);
                        if (start > 0) u.setInterviewPeriodStart(Instant.ofEpochSecond(start));
                        if (end > 0) u.setInterviewPeriodEnd(Instant.ofEpochSecond(end).plus(GRACE));
                        u.setInterviewStatus("active");
                    }
                    case "subscription.cancelled", "subscription.halted", "subscription.completed",
                         "subscription.paused", "subscription.pending" ->
                            u.setInterviewStatus(event.substring("subscription.".length()));
                    default -> { return true; }
                }
                users.save(u);
                return true;
            }
            var practice = users.findByRazorpaySubscriptionId(subId).isEmpty() ? users.findByPracticeSubscriptionId(subId) : java.util.Optional.<User>empty();
            if (practice.isPresent()) {
                User u = practice.get();
                switch (event) {
                    case "subscription.activated", "subscription.charged", "subscription.resumed" -> {
                        // A new billing cycle: the monthly allowance restarts from current_start.
                        long start = sub.path("current_start").asLong(0), end = sub.path("current_end").asLong(0);
                        if (start > 0) u.setPracticePeriodStart(Instant.ofEpochSecond(start));
                        if (end > 0) u.setPracticePeriodEnd(Instant.ofEpochSecond(end).plus(GRACE));
                        u.setPracticeStatus("active");
                    }
                    case "subscription.cancelled", "subscription.halted", "subscription.completed",
                         "subscription.paused", "subscription.pending" ->
                            u.setPracticeStatus(event.substring("subscription.".length()));
                    default -> { return true; }
                }
                users.save(u);
                return true;
            }
            users.findByRazorpaySubscriptionId(subId).ifPresentOrElse(u -> {
                switch (event) {
                    case "subscription.activated", "subscription.charged", "subscription.resumed" -> {
                        long end = sub.path("current_end").asLong(0);
                        if (end > 0) u.setPremiumUntil(Instant.ofEpochSecond(end).plus(GRACE));
                        forgetPremium(u.getEmail());
                        u.setSubscriptionStatus("active");
                    }
                    case "subscription.cancelled", "subscription.halted", "subscription.completed",
                         "subscription.paused", "subscription.pending" ->
                            u.setSubscriptionStatus(event.substring("subscription.".length()));
                    default -> { return; }
                }
                users.save(u);
            }, () -> log.warn("Razorpay webhook {} for unknown subscription {}", event, subId));
            return true;
        } catch (Exception e) {
            log.error("Razorpay webhook could not be processed", e);
            return true;   // signature was valid; don't make Razorpay retry a payload we can't parse
        }
    }

    private JsonNode call(String method, String path, Object body) {
        try {
            String auth = Base64.getEncoder().encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));
            HttpRequest req = HttpRequest.newBuilder(URI.create(API + path))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.error("Razorpay {} {} failed: {} {}", method, path, res.statusCode(), res.body());
                // Razorpay explains itself in error.description (e.g. a wrong plan id); surface it so the cause is visible.
                String why = "";
                try { why = json.readTree(res.body()).path("error").path("description").asText(""); } catch (Exception ignored) { }
                throw new IllegalStateException("Payment provider error (HTTP " + res.statusCode() + ")" + (why.isBlank() ? "" : ": " + why));
            }
            return json.readTree(res.body());
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Could not reach the payment provider. Please try again.", e);
        }
    }

    static String hmac(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // Constant-time compare so the signature check can't be probed byte by byte.
    private static boolean matches(String expected, String given) {
        return given != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }
}
