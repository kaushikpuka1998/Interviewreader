package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Payments: Premium status, plan list, checkout signature verification, pass granting and the webhook's signature gate. */
class BillingServiceTest {

    private static final String SECRET = "secret";
    private UserRepository users;
    private CouponService coupons;
    private BillingService billing;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        coupons = mock(CouponService.class);
        billing = new BillingService(users, "boss@example.com", "key", SECRET, "whsec",
                999, 2200, 6500, 14000, 0, 0, 0, "", "", "", "", "", "", "a", "b", "c", "", "", "a", "b", "", "");
        ReflectionTestUtils.setField(billing, "coupons", coupons);
    }

    private static User user(String email) {
        User u = new User();
        u.setId(7L);
        u.setEmail(email);
        return u;
    }

    private static User withPendingOrder(String plan) {
        User u = user("m@example.com");
        u.setPremiumPendingPlan(plan);
        u.setPremiumPendingOrderId("order_1");
        return u;
    }

    private boolean check(User u, String sig) { return billing.verifyPremiumOrder(u, "pay_1", "order_1", sig); }

    @Test
    void hmacMatchesTheRazorpayAlgorithm() {
        assertEquals("52115a0d3400de9e86aade1f1b6eba9e8974604f4e267a9e9a16633a4c8dd2cb", BillingService.hmac("order_1|pay_1", SECRET));
    }

    // ---- who is Premium ----

    @Test
    void premiumStatus() {
        assertFalse(billing.isPremium((User) null));
        assertFalse(billing.isPremium(user("free@example.com")));
        assertTrue(billing.isPremium(user("BOSS@example.com")), "admins are always premium, case-insensitive");
        User paid = user("p@example.com");
        paid.setPremiumUntil(Instant.now().plus(Duration.ofDays(1)));
        assertTrue(billing.isPremium(paid));
        paid.setPremiumUntil(Instant.now().minus(Duration.ofSeconds(1)));
        assertFalse(billing.isPremium(paid), "expired passes stop working");
    }

    @Test
    void everythingFreeFlagMakesAllMembersPremium() {
        var flags = mock(com.interview.backend.repository.FeatureFlagRepository.class);
        var flag = mock(com.interview.backend.entity.FeatureFlag.class);
        when(flag.isEnabled()).thenReturn(true);
        when(flags.findById("premium_free")).thenReturn(java.util.Optional.of(flag));
        ReflectionTestUtils.setField(billing, "flags", flags);
        assertTrue(billing.isPremium(user("anyone@example.com")));
    }

    // ---- plans ----

    @Test
    @SuppressWarnings("unchecked")
    void planListHidesSprintUnlessAnInterviewIsComingUp() {
        List<String> keys = billing.premiumPlans(user("a@example.com")).stream().map(p -> (String) p.get("key")).toList();
        assertEquals(List.of("monthly", "yearly", "lifetime"), keys);
        User soon = user("a@example.com");
        soon.setInterviewDate(LocalDate.now().plusDays(10));
        assertTrue(billing.sprintEligible(soon));
        assertEquals("sprint", billing.premiumPlans(soon).get(0).get("key"));
        soon.setInterviewDate(LocalDate.now().plusDays(90));
        assertFalse(billing.sprintEligible(soon));
        soon.setInterviewDate(LocalDate.now().minusDays(1));
        assertFalse(billing.sprintEligible(soon));
    }

    @Test
    void pricesComeFromConfig() {
        Map<String, Object> monthly = billing.premiumPlans().stream().filter(p -> "monthly".equals(p.get("key"))).findFirst().orElseThrow();
        assertEquals(2200, monthly.get("price"));
    }

    // ---- international prices ----

    private Map<String, Object> plan(List<Map<String, Object>> plans, String key) {
        return plans.stream().filter(p -> key.equals(p.get("key"))).findFirst().orElseThrow();
    }

    @Test
    void foreignCurrenciesUseTheirOwnFixedPrices() {
        var usd = billing.premiumPlans(user("a@example.com"), "usd");   // case-insensitive
        assertEquals(25, plan(usd, "monthly").get("price"));
        assertEquals(75, plan(usd, "yearly").get("price"));
        assertEquals(160, plan(usd, "lifetime").get("price"));
        assertEquals("USD", plan(usd, "monthly").get("currency"));
        assertEquals(0, plan(usd, "yearly").get("regular"), "the crossed-out price is a rupee price, so it is not shown abroad");
        assertEquals(19, plan(billing.premiumPlans(user("a@example.com"), "GBP"), "monthly").get("price"));
    }

    @Test
    void missingOrUnknownCurrencyFallsBackToRupees() {
        for (String c : new String[]{null, "", "JPY", "xx"}) {
            var plans = billing.premiumPlans(user("a@example.com"), c);
            assertEquals(2200, plan(plans, "monthly").get("price"), "currency " + c);
            assertEquals("INR", plan(plans, "monthly").get("currency"));
        }
        assertEquals(List.of("INR", "USD", "EUR", "GBP"), billing.currencies());
    }

    @Test
    void aBrokenPriceTableEntryIsIgnoredNotFatal() {
        ReflectionTestUtils.setField(billing, "foreignPricesCsv", "USD=1/2;EUR=a/b/c/d;GBP=9/19/59/129;;junk");
        assertEquals(List.of("INR", "GBP"), billing.currencies());
        assertEquals("INR", billing.currencyOrInr("USD"));
    }

    @Test
    void couponQuoteIsInTheChosenCurrencyAndPercentOnlyAbroad() {
        when(coupons.quote("SAVE", "monthly", 25, 7L, true)).thenReturn(new CouponService.Quote(true, "Code applied.", "SAVE", 5, 20));
        var q = billing.quoteCoupon(user("a@example.com"), "monthly", "SAVE", "USD");
        assertEquals(25, q.get("price"));
        assertEquals(20, q.get("finalPrice"));
        assertEquals("USD", q.get("currency"));
        verify(coupons).quote("SAVE", "monthly", 25, 7L, true);
        when(coupons.quote("SAVE", "monthly", 2200, 7L, false)).thenReturn(new CouponService.Quote(true, "Code applied.", "SAVE", 220, 1980));
        assertEquals(1980, billing.quoteCoupon(user("a@example.com"), "monthly", "SAVE").get("finalPrice"), "no currency = rupees, as before");
    }

    @Test
    void anOrderIsRefusedBeforeRazorpayWhenTheCouponDoesNotApplyAbroad() {
        when(coupons.quote("FLAT", "yearly", 75, 7L, true)).thenReturn(new CouponService.Quote(false, "That code is for payments in rupees.", null, 0, 75));
        var e = assertThrows(IllegalArgumentException.class, () -> billing.createPremiumOrder(user("a@example.com"), "yearly", "FLAT", "USD"));
        assertEquals("That code is for payments in rupees.", e.getMessage());
        verify(users, never()).save(any());
    }

    // ---- checkout verification ----

    @Test
    void rejectsAWrongOrderOrSignatureAndGrantsNothing() {
        User u = withPendingOrder("monthly");
        assertFalse(billing.verifyPremiumOrder(u, "pay_1", "order_other", BillingService.hmac("order_other|pay_1", SECRET)));
        assertFalse(check(u, "deadbeef"));
        assertFalse(check(u, null));
        assertNull(u.getPremiumUntil());
        verify(users, never()).save(any());
    }

    @Test
    void validPaymentGrantsTheMonthlyPassOnce() {
        User u = withPendingOrder("monthly");
        assertTrue(check(u, BillingService.hmac("order_1|pay_1", SECRET)));
        assertEquals("monthly", u.getPremiumPlan());
        assertTrue(u.getPremiumUntil().isAfter(Instant.now().plus(Duration.ofDays(30))));
        assertTrue(u.getPremiumUntil().isBefore(Instant.now().plus(Duration.ofDays(32))));
        assertNull(u.getPremiumPendingOrderId());
        assertNull(u.getPremiumPendingPlan());
        assertNull(u.getPremiumGrantedBy(), "paid time can't be revoked as a free grant");
        verify(users).save(u);
        assertFalse(check(u, BillingService.hmac("order_1|pay_1", SECRET)), "the same order cannot be replayed");
    }

    @Test
    void newPassStacksOnRunningPremium() {
        User u = withPendingOrder("yearly");
        Instant running = Instant.now().plus(Duration.ofDays(10));
        u.setPremiumUntil(running);
        assertTrue(check(u, BillingService.hmac("order_1|pay_1", SECRET)));
        assertEquals(running.plus(Duration.ofDays(365)), u.getPremiumUntil());
    }

    @Test
    void lifetimeIsNeverShortenedByALaterPass() {
        User u = withPendingOrder("lifetime");
        assertTrue(check(u, BillingService.hmac("order_1|pay_1", SECRET)));
        assertTrue(u.getPremiumUntil().isAfter(Instant.parse("2900-01-01T00:00:00Z")));
        Instant forever = u.getPremiumUntil();
        u.setPremiumPendingPlan("monthly");
        u.setPremiumPendingOrderId("order_1");
        assertTrue(check(u, BillingService.hmac("order_1|pay_1", SECRET)));
        assertFalse(u.getPremiumUntil().isBefore(forever), "never shortened");
        assertEquals("lifetime", u.getPremiumPlan());
    }

    @Test
    void aCouponCountsAsUsedOnlyAfterPayment() {
        User u = withPendingOrder("monthly");
        u.setPremiumPendingCoupon("SAVE10");
        check(u, "bad");
        verify(coupons, never()).redeem(any(), any());
        assertTrue(check(u, BillingService.hmac("order_1|pay_1", SECRET)));
        verify(coupons).redeem("SAVE10", 7L);
        assertNull(u.getPremiumPendingCoupon());
    }

    // ---- webhook ----

    @Test
    void webhookNeedsAValidSignature() {
        String body = "{\"event\":\"unknown.event\"}";
        assertFalse(billing.handleWebhook(body, "wrong"));
        assertFalse(billing.handleWebhook(body, null));
        assertTrue(billing.handleWebhook(body, BillingService.hmac(body, "whsec")));
    }

    @Test
    void webhookWithoutAConfiguredSecretRejectsEverything() {
        BillingService noSecret = new BillingService(users, "", "key", SECRET, "",
                999, 2200, 6500, 14000, 0, 0, 0, "", "", "", "", "", "", "a", "b", "c", "", "", "a", "b", "", "");
        assertFalse(noSecret.handleWebhook("{}", "anything"));
    }

    @Test
    void validSignatureWithAnUnparseablePayloadStillAcknowledges() {
        String junk = "not json";
        assertTrue(billing.handleWebhook(junk, BillingService.hmac(junk, "whsec")), "so Razorpay does not keep retrying");
    }
}
