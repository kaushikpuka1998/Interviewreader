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
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Premium = paid Razorpay monthly subscription (admins are always premium).
 * Talks to the Razorpay REST API directly; no SDK needed for the three calls we make.
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
    private final String keyId, keySecret, webhookSecret, planId, priceLabel;

    public BillingService(UserRepository users,
                          @Value("${app.admin.emails:}") String adminEmailsCsv,
                          @Value("${app.razorpay.key-id:}") String keyId,
                          @Value("${app.razorpay.key-secret:}") String keySecret,
                          @Value("${app.razorpay.webhook-secret:}") String webhookSecret,
                          @Value("${app.razorpay.plan-id:}") String planId,
                          @Value("${app.premium.price-label:}") String priceLabel) {
        this.users = users;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(",")).map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
        this.planId = planId;
        this.priceLabel = priceLabel;
    }

    public String priceLabel() { return priceLabel; }

    public boolean isPremium(User u) {
        if (u == null) return false;
        if (u.getEmail() != null && adminEmails.contains(u.getEmail().toLowerCase())) return true;
        return u.getPremiumUntil() != null && u.getPremiumUntil().isAfter(Instant.now());
    }

    public boolean isPremium(String email) {
        return email != null && users.findByEmail(email).map(this::isPremium).orElse(false);
    }

    public Map<String, Object> status(User u) {
        return Map.of(
                "premium", isPremium(u),
                "premiumUntil", u.getPremiumUntil() == null ? "" : u.getPremiumUntil().toString(),
                "status", u.getSubscriptionStatus() == null ? "" : u.getSubscriptionStatus(),
                "priceLabel", priceLabel);
    }

    /** Creates a Razorpay subscription for the member and returns what Checkout needs. */
    public Map<String, Object> subscribe(User u) {
        java.util.List<String> missing = new java.util.ArrayList<>();
        if (keyId.isBlank()) missing.add("RAZORPAY_KEY_ID");
        if (keySecret.isBlank()) missing.add("RAZORPAY_KEY_SECRET");
        if (planId.isBlank()) missing.add("RAZORPAY_PLAN_ID");
        if (!missing.isEmpty()) {
            log.warn("Premium checkout blocked: missing {}", missing);
            throw new IllegalStateException("Payments are not configured yet.");
        }
        Map<String, Object> body = Map.of(
                "plan_id", planId,
                "total_count", 120,              // up to 10 years of monthly renewals; member can cancel any time
                "customer_notify", 1,
                "notes", Map.of("email", u.getEmail()));
        JsonNode sub = call("POST", "/subscriptions", body);
        u.setRazorpaySubscriptionId(sub.path("id").asText());
        u.setSubscriptionStatus(sub.path("status").asText("created"));
        users.save(u);
        return Map.of(
                "subscriptionId", u.getRazorpaySubscriptionId(),
                "keyId", keyId,
                "priceLabel", priceLabel,
                "email", u.getEmail(),
                "name", u.getName() == null ? "" : u.getName());
    }

    /** Checkout success handler: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
    public boolean verifyCheckout(User u, String paymentId, String subscriptionId, String signature) {
        if (subscriptionId == null || !subscriptionId.equals(u.getRazorpaySubscriptionId())) return false;
        if (!matches(hmac(paymentId + "|" + subscriptionId, keySecret), signature)) return false;
        Instant until = Instant.now().plus(FIRST_PERIOD);
        if (u.getPremiumUntil() == null || u.getPremiumUntil().isBefore(until)) u.setPremiumUntil(until);
        u.setSubscriptionStatus("active");
        users.save(u);
        return true;
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
            JsonNode sub = root.path("payload").path("subscription").path("entity");
            String subId = sub.path("id").asText(null);
            if (subId == null) return true;   // not a subscription event; acknowledge and ignore
            users.findByRazorpaySubscriptionId(subId).ifPresentOrElse(u -> {
                switch (event) {
                    case "subscription.activated", "subscription.charged", "subscription.resumed" -> {
                        long end = sub.path("current_end").asLong(0);
                        if (end > 0) u.setPremiumUntil(Instant.ofEpochSecond(end).plus(GRACE));
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
