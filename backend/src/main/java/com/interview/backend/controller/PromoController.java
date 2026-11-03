package com.interview.backend.controller;

import com.interview.backend.entity.Coupon;
import com.interview.backend.entity.PromoBanner;
import com.interview.backend.repository.CouponRedemptionRepository;
import com.interview.backend.repository.CouponRepository;
import com.interview.backend.repository.PromoBannerRepository;
import com.interview.backend.service.BillingService;
import com.interview.backend.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Offers: the site-wide banner (public to read, switched on by an admin) and the Premium discount coupons (admin only).
 * Public reads are cached for 30 seconds, since the banner is requested on every page load; an admin save clears the cache.
 */
@RestController
@RequiredArgsConstructor
public class PromoController {

    private static final Pattern CODE = Pattern.compile("^[A-Z0-9_-]{3,24}$");
    private static final Set<String> PLANS = Set.of("monthly", "yearly", "lifetime");
    private static final long CACHE_MS = 30_000;

    private final PromoBannerRepository banners;
    private final CouponRepository coupons;
    private final CouponRedemptionRepository redemptions;
    private final BillingService billing;

    private record Snapshot(PromoBanner banner, String couponLabel, boolean couponLive, long at) {}
    private volatile Snapshot cache;

    // ---------- public ----------

    /** The banner a visitor should see right now, or {"active": false}. Honours the dates, the audience and the coupon's own validity. */
    @GetMapping("/public/banner")
    public Map<String, Object> banner() {
        Snapshot s = snapshot();
        PromoBanner b = s.banner();
        Instant now = Instant.now();
        if (b == null || !b.isEnabled() || b.getMessage() == null || b.getMessage().isBlank()
                || (b.getStartsAt() != null && now.isBefore(b.getStartsAt())) || (b.getEndsAt() != null && now.isAfter(b.getEndsAt())))
            return Map.of("active", false);
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        boolean signedIn = a != null && a.isAuthenticated() && !"anonymousUser".equals(a.getName());
        switch (b.getAudience()) {
            case "signed-out" -> { if (signedIn) return Map.of("active", false); }
            case "free" -> { if (!signedIn || billing.isPremium(a.getName())) return Map.of("active", false); }
            default -> { }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active", true);
        out.put("id", b.getUpdatedAt().toEpochMilli());   // changes whenever the admin edits it, so a dismissed banner returns if it is changed
        out.put("message", b.getMessage());
        if (b.getCouponCode() != null && s.couponLive()) { out.put("couponCode", b.getCouponCode()); out.put("couponLabel", s.couponLabel()); }
        out.put("ctaLabel", b.getCtaLabel());
        out.put("ctaUrl", b.getCtaUrl());
        out.put("tone", b.getTone());
        out.put("dismissible", b.isDismissible());
        return out;
    }

    private Snapshot snapshot() {
        Snapshot s = cache;
        if (s != null && System.currentTimeMillis() - s.at() < CACHE_MS) return s;
        PromoBanner b = banners.findById(1L).orElse(null);
        String label = null;
        boolean live = false;
        if (b != null && b.getCouponCode() != null) {
            var k = coupons.findByCodeIgnoreCase(b.getCouponCode()).orElse(null);
            if (k != null) { label = CouponService.label(k); live = couponOpen(k); }
        }
        return cache = new Snapshot(b, label, live, System.currentTimeMillis());
    }

    private static boolean couponOpen(Coupon k) {
        Instant now = Instant.now();
        return k.isActive() && (k.getStartsAt() == null || !now.isBefore(k.getStartsAt())) && (k.getEndsAt() == null || !now.isAfter(k.getEndsAt()))
                && (k.getMaxRedemptions() == null || k.getRedemptions() < k.getMaxRedemptions());
    }

    // ---------- admin: banner ----------

    public record BannerRequest(Boolean enabled, String message, String couponCode, String ctaLabel, String ctaUrl, String audience, String tone,
                                Boolean dismissible, String startsAt, String endsAt) {}

    @GetMapping("/admin/banner")
    public Map<String, Object> adminBanner() {
        return bannerMap(banners.findById(1L).orElseGet(PromoBanner::new));
    }

    @PutMapping("/admin/banner")
    @Transactional
    public ResponseEntity<?> saveBanner(@RequestBody BannerRequest req) {
        try {
            PromoBanner b = banners.findById(1L).orElseGet(PromoBanner::new);
            b.setId(1L);
            b.setEnabled(Boolean.TRUE.equals(req.enabled()));
            b.setMessage(text(req.message(), 200, "Message"));
            String code = CouponService.normalise(req.couponCode());
            if (!code.isEmpty() && coupons.findByCodeIgnoreCase(code).isEmpty()) throw new IllegalArgumentException("There is no coupon with the code " + code + ". Create it first.");
            b.setCouponCode(code.isEmpty() ? null : code);
            b.setCtaLabel(text(req.ctaLabel(), 40, "Button label"));
            b.setCtaUrl(link(req.ctaUrl()));
            if (b.getCtaUrl() != null && b.getCtaLabel() == null) throw new IllegalArgumentException("Give the button a label.");
            b.setAudience(Set.of("all", "signed-out", "free").contains(req.audience()) ? req.audience() : "all");
            b.setTone(Set.of("amber", "emerald", "violet").contains(req.tone()) ? req.tone() : "amber");
            b.setDismissible(!Boolean.FALSE.equals(req.dismissible()));
            b.setStartsAt(instant(req.startsAt()));
            b.setEndsAt(instant(req.endsAt()));
            if (b.isEnabled() && b.getMessage() == null) throw new IllegalArgumentException("Write the banner message before switching it on.");
            if (b.getStartsAt() != null && b.getEndsAt() != null && !b.getEndsAt().isAfter(b.getStartsAt())) throw new IllegalArgumentException("The end must be after the start.");
            b.setUpdatedAt(Instant.now());
            banners.save(b);
            cache = null;
            return ResponseEntity.ok(bannerMap(b));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Map<String, Object> bannerMap(PromoBanner b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", b.isEnabled());
        m.put("message", b.getMessage() == null ? "" : b.getMessage());
        m.put("couponCode", b.getCouponCode() == null ? "" : b.getCouponCode());
        m.put("ctaLabel", b.getCtaLabel() == null ? "" : b.getCtaLabel());
        m.put("ctaUrl", b.getCtaUrl() == null ? "" : b.getCtaUrl());
        m.put("audience", b.getAudience());
        m.put("tone", b.getTone());
        m.put("dismissible", b.isDismissible());
        m.put("startsAt", b.getStartsAt() == null ? "" : b.getStartsAt().toString());
        m.put("endsAt", b.getEndsAt() == null ? "" : b.getEndsAt().toString());
        return m;
    }

    // ---------- admin: coupons ----------

    public record CouponRequest(String code, String kind, Integer value, List<String> appliesTo, Boolean active, String startsAt, String endsAt,
                                Integer maxRedemptions, String note) {}

    @GetMapping("/admin/coupons")
    public List<Map<String, Object>> listCoupons() {
        return coupons.findAllByOrderByCreatedAtDesc().stream().map(this::couponMap).toList();
    }

    @PostMapping("/admin/coupons")
    @Transactional
    public ResponseEntity<?> createCoupon(@RequestBody CouponRequest req) {
        try {
            String code = CouponService.normalise(req.code());
            if (!CODE.matcher(code).matches()) throw new IllegalArgumentException("A code is 3-24 letters, digits, _ or -.");
            if (coupons.findByCodeIgnoreCase(code).isPresent()) throw new IllegalArgumentException("That code already exists.");
            Coupon k = new Coupon();
            k.setCode(code);
            apply(k, req);
            return ResponseEntity.ok(couponMap(coupons.save(k)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** The code itself is fixed once created (members may already hold it); everything else can change. */
    @PutMapping("/admin/coupons/{id}")
    @Transactional
    public ResponseEntity<?> updateCoupon(@PathVariable Long id, @RequestBody CouponRequest req) {
        return coupons.findById(id).<ResponseEntity<?>>map(k -> {
            try {
                apply(k, req);
                cache = null;
                return ResponseEntity.ok(couponMap(coupons.save(k)));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/admin/coupons/{id}")
    @Transactional
    public ResponseEntity<?> deleteCoupon(@PathVariable Long id) {
        return coupons.findById(id).<ResponseEntity<?>>map(k -> {
            redemptions.deleteByCouponId(id);
            coupons.delete(k);
            cache = null;
            return ResponseEntity.ok(Map.of("ok", true));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private void apply(Coupon k, CouponRequest req) {
        String kind = "flat".equals(req.kind()) ? "flat" : "percent";
        int value = req.value() == null ? 0 : req.value();
        if ("percent".equals(kind) && (value < 1 || value > 90)) throw new IllegalArgumentException("A percentage discount is between 1 and 90.");
        if ("flat".equals(kind) && (value < 1 || value > 100000)) throw new IllegalArgumentException("A flat discount is between ₹1 and ₹1,00,000.");
        List<String> plans = req.appliesTo() == null ? List.of() : req.appliesTo().stream().filter(PLANS::contains).distinct().toList();
        k.setKind(kind);
        k.setValue(value);
        k.setAppliesTo(plans.isEmpty() || plans.size() == PLANS.size() ? null : String.join(",", plans));
        k.setActive(!Boolean.FALSE.equals(req.active()));
        k.setStartsAt(instant(req.startsAt()));
        k.setEndsAt(instant(req.endsAt()));
        if (k.getStartsAt() != null && k.getEndsAt() != null && !k.getEndsAt().isAfter(k.getStartsAt())) throw new IllegalArgumentException("The end must be after the start.");
        if (req.maxRedemptions() != null && req.maxRedemptions() < 1) throw new IllegalArgumentException("The limit must be at least 1, or empty for unlimited.");
        k.setMaxRedemptions(req.maxRedemptions());
        k.setNote(text(req.note(), 200, "Note"));
    }

    private Map<String, Object> couponMap(Coupon k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("code", k.getCode());
        m.put("kind", k.getKind());
        m.put("value", k.getValue());
        m.put("label", CouponService.label(k));
        m.put("appliesTo", k.getAppliesTo() == null || k.getAppliesTo().isBlank() ? List.of() : List.of(k.getAppliesTo().split(",")));
        m.put("active", k.isActive());
        m.put("startsAt", k.getStartsAt() == null ? "" : k.getStartsAt().toString());
        m.put("endsAt", k.getEndsAt() == null ? "" : k.getEndsAt().toString());
        m.put("maxRedemptions", k.getMaxRedemptions());
        m.put("redemptions", k.getRedemptions());
        m.put("note", k.getNote() == null ? "" : k.getNote());
        m.put("live", couponOpen(k));
        return m;
    }

    // ---------- helpers ----------

    private static String text(String s, int max, String label) {
        if (s == null) return null;
        String t = s.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").strip();
        if (t.isEmpty()) return null;
        if (t.length() > max) throw new IllegalArgumentException(label + " can be at most " + max + " characters.");
        return t;
    }

    /** A path on this site ("/roadmaps") or an http(s) address; nothing else (no javascript: or data: links). */
    private static String link(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.strip();
        if (t.length() > 300) throw new IllegalArgumentException("The button link can be at most 300 characters.");
        if (t.startsWith("/") && !t.startsWith("//")) return t;
        if (t.matches("(?i)^https?://[^\\s]+$")) return t;
        throw new IllegalArgumentException("The button link must be a path like /roadmaps or an http(s) address.");
    }

    private static Instant instant(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Instant.parse(s.strip()); } catch (Exception e) { throw new IllegalArgumentException("Use a valid date and time."); }
    }
}
