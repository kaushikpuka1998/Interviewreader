package com.interview.backend.controller;

import com.interview.backend.entity.Coupon;
import com.interview.backend.entity.MemberMessage;
import com.interview.backend.entity.User;
import com.interview.backend.repository.CouponRepository;
import com.interview.backend.repository.MemberMessageRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.CouponService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Admin-to-member messages (no email). Members read theirs at /messages/mine; admins write under /admin/** . */
@RestController
public class MemberMessageController {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom random = new SecureRandom();
    private final MemberMessageRepository messages;
    private final UserRepository users;
    private final CouponRepository coupons;

    public MemberMessageController(MemberMessageRepository messages, UserRepository users, CouponRepository coupons) {
        this.messages = messages;
        this.users = users;
        this.coupons = coupons;
    }

    /** Open messages for the signed-in member; empty for visitors. */
    @GetMapping("/messages/mine")
    public List<Map<String, Object>> mine() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) return List.of();
        return users.findByEmail(auth.getName())
                .map(u -> messages.findByUserIdAndClosedAtIsNullOrderByCreatedAtDesc(u.getId()).stream().map(this::row).toList())
                .orElse(List.of());
    }

    public record CouponSpec(Integer percent, Integer days) {}
    public record MessageInput(String email, String title, String body, CouponSpec coupon) {}

    @PostMapping("/admin/messages")
    public ResponseEntity<?> send(@RequestBody MessageInput in) {
        String email = in.email() == null ? "" : in.email().trim().toLowerCase();
        String title = in.title() == null ? "" : in.title().trim();
        String body = in.body() == null ? "" : in.body().trim();
        if (title.isEmpty() || title.length() > 120) return bad("Title is required (max 120 characters).");
        if (body.isEmpty() || body.length() > 1000) return bad("Message is required (max 1000 characters).");
        User u = users.findByEmail(email).orElse(null);
        if (u == null) return bad("No member with that email.");
        MemberMessage m = new MemberMessage();
        m.setUserId(u.getId());
        m.setEmail(u.getEmail());
        m.setTitle(title);
        m.setBody(body);
        if (in.coupon() != null && in.coupon().percent() != null) {
            int pct = in.coupon().percent();
            int days = in.coupon().days() == null ? 14 : in.coupon().days();
            if (pct < 1 || pct > 90) return bad("Coupon percent must be 1 to 90.");
            if (days < 1 || days > 365) return bad("Coupon validity must be 1 to 365 days.");
            Coupon k = new Coupon();
            k.setCode(freshCode());
            k.setKind("percent");
            k.setValue(pct);
            k.setMaxRedemptions(1);
            k.setEndsAt(Instant.now().plus(days, ChronoUnit.DAYS));
            k.setForUserId(u.getId());
            k.setNote("Personal coupon for " + u.getEmail());
            coupons.save(k);
            m.setCouponCode(k.getCode());
        }
        messages.save(m);
        return ResponseEntity.ok(list());
    }

    @GetMapping("/admin/messages")
    public List<Map<String, Object>> adminList() {
        return list();
    }

    @PostMapping("/admin/messages/{id}/close")
    public ResponseEntity<?> close(@PathVariable Long id) {
        return messages.findById(id).map(m -> {
            if (m.getClosedAt() == null) { m.setClosedAt(Instant.now()); messages.save(m); }
            return ResponseEntity.ok((Object) list());
        }).orElse(ResponseEntity.notFound().build());
    }

    private List<Map<String, Object>> list() {
        return messages.findTop200ByOrderByCreatedAtDesc().stream().map(m -> {
            Map<String, Object> r = new LinkedHashMap<>(row(m));
            r.put("email", m.getEmail());
            r.put("createdAt", m.getCreatedAt().toString());
            r.put("closed", m.getClosedAt() != null);
            return r;
        }).toList();
    }

    private Map<String, Object> row(MemberMessage m) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", m.getId());
        r.put("title", m.getTitle());
        r.put("body", m.getBody());
        r.put("couponCode", m.getCouponCode() == null ? "" : m.getCouponCode());
        String label = "";
        if (m.getCouponCode() != null) label = coupons.findByCodeIgnoreCase(m.getCouponCode()).map(CouponService::label).orElse("");
        r.put("couponLabel", label);
        return r;
    }

    private String freshCode() {
        for (;;) {
            StringBuilder sb = new StringBuilder("FOR-");
            for (int i = 0; i < 6; i++) sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            if (coupons.findByCodeIgnoreCase(sb.toString()).isEmpty()) return sb.toString();
        }
    }

    private static ResponseEntity<?> bad(String msg) {
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
