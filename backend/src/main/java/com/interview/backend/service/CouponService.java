package com.interview.backend.service;

import com.interview.backend.entity.Coupon;
import com.interview.backend.entity.CouponRedemption;
import com.interview.backend.repository.CouponRedemptionRepository;
import com.interview.backend.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Checks a coupon against a Premium pass and works out the price. The server decides the amount at order time; the page only shows it.
 * A use is counted when the payment is confirmed (see BillingService), not when the order is created, so abandoned checkouts don't burn codes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository coupons;
    private final CouponRedemptionRepository redemptions;

    public record Quote(boolean valid, String message, String code, int discount, int finalPrice) {
        static Quote no(String message, int price) { return new Quote(false, message, null, 0, price); }
    }

    public static String normalise(String code) {
        return code == null ? "" : code.strip().toUpperCase(Locale.ROOT);
    }

    /** The price (in rupees) after applying {@code code} to {@code plan}; invalid with a reason fit to show the member otherwise. */
    public Quote quote(String code, String plan, int price, Long userId) {
        String c = normalise(code);
        if (c.isEmpty()) return Quote.no("Enter a coupon code.", price);
        Optional<Coupon> found = coupons.findByCodeIgnoreCase(c);
        if (found.isEmpty() || !found.get().isActive()) return Quote.no("That code isn't valid.", price);
        Coupon k = found.get();
        Instant now = Instant.now();
        if (k.getStartsAt() != null && now.isBefore(k.getStartsAt())) return Quote.no("That code isn't active yet.", price);
        if (k.getEndsAt() != null && now.isAfter(k.getEndsAt())) return Quote.no("That code has expired.", price);
        if (k.getAppliesTo() != null && !k.getAppliesTo().isBlank() && !plans(k).contains(plan))
            return Quote.no("That code doesn't apply to the " + plan + " pass.", price);
        if (k.getMaxRedemptions() != null && k.getRedemptions() >= k.getMaxRedemptions()) return Quote.no("That code has been fully used.", price);
        if (userId != null && redemptions.existsByUserIdAndCouponId(userId, k.getId())) return Quote.no("You have already used that code.", price);
        int discount = "percent".equals(k.getKind()) ? price * k.getValue() / 100 : k.getValue();
        discount = Math.max(0, Math.min(discount, price - 1));   // never free: Razorpay needs at least ₹1
        return new Quote(true, "Code applied.", k.getCode(), discount, price - discount);
    }

    /** Counts one use by this member, once. Returns false (and counts nothing) if they already used it or the cap is reached. */
    public boolean redeem(String code, Long userId) {
        Optional<Coupon> found = coupons.findByCodeIgnoreCase(normalise(code));
        if (found.isEmpty() || userId == null) return false;
        Coupon k = found.get();
        try {
            if (redemptions.existsByUserIdAndCouponId(userId, k.getId())) return false;
            CouponRedemption r = new CouponRedemption();
            r.setUserId(userId); r.setCouponId(k.getId());
            redemptions.save(r);
        } catch (DataIntegrityViolationException dup) {
            return false;
        }
        if (coupons.countUse(k.getId()) == 0) log.warn("Coupon {} was used past its cap by a payment already taken", k.getCode());
        return true;
    }

    static List<String> plans(Coupon k) {
        return Arrays.stream(k.getAppliesTo().split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** "20% off" or "₹300 off" for the banner and the member. */
    public static String label(Coupon k) {
        return "percent".equals(k.getKind()) ? k.getValue() + "% off" : "₹" + k.getValue() + " off";
    }
}
