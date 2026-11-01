package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Context-path is /api, so this maps to /api/billing/*. Everything but the webhook needs a signed-in member.
@RestController
@RequestMapping("/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billing;
    private final UserRepository users;

    private User currentUser() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return billing.status(currentUser());
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe() {
        try {
            return ResponseEntity.ok(billing.subscribe(currentUser()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    public record VerifyRequest(String razorpay_payment_id, String razorpay_subscription_id, String razorpay_signature) {}

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody VerifyRequest req) {
        User u = currentUser();
        if (!billing.verifyCheckout(u, req.razorpay_payment_id(), req.razorpay_subscription_id(), req.razorpay_signature()))
            return ResponseEntity.badRequest().body(Map.of("error", "Payment could not be verified."));
        return ResponseEntity.ok(billing.status(u));
    }

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
}
