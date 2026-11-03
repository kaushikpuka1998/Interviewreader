package com.interview.backend.service;

import com.interview.backend.entity.Coupon;
import com.interview.backend.repository.CouponRedemptionRepository;
import com.interview.backend.repository.CouponRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CouponServiceTest {

    private CouponRepository coupons;
    private CouponRedemptionRepository redemptions;
    private CouponService service;

    @BeforeEach
    void setUp() {
        coupons = mock(CouponRepository.class);
        redemptions = mock(CouponRedemptionRepository.class);
        service = new CouponService(coupons, redemptions);
    }

    private Coupon coupon(String kind, int value) {
        Coupon k = new Coupon();
        k.setId(7L); k.setCode("SAVE"); k.setKind(kind); k.setValue(value);
        when(coupons.findByCodeIgnoreCase("SAVE")).thenReturn(Optional.of(k));
        return k;
    }

    @Test
    void percentAndFlatDiscountsAreWorkedOutOnThePrice() {
        coupon("percent", 20);
        var q = service.quote(" save ", "yearly", 6500, 1L);
        assertTrue(q.valid());
        assertEquals(1300, q.discount());
        assertEquals(5200, q.finalPrice());
        coupon("flat", 500);
        assertEquals(6000, service.quote("SAVE", "yearly", 6500, 1L).finalPrice());
    }

    @Test
    void aCodeNeverMakesAPassFree() {
        coupon("flat", 100000);
        var q = service.quote("SAVE", "monthly", 2200, 1L);
        assertEquals(1, q.finalPrice());
    }

    @Test
    void unknownOffOrWrongPlanCodesAreRefused() {
        assertFalse(service.quote("NOPE", "yearly", 6500, 1L).valid());
        Coupon k = coupon("percent", 10);
        k.setActive(false);
        assertFalse(service.quote("SAVE", "yearly", 6500, 1L).valid());
        k.setActive(true);
        k.setAppliesTo("yearly,lifetime");
        assertFalse(service.quote("SAVE", "monthly", 2200, 1L).valid());
        assertTrue(service.quote("SAVE", "yearly", 6500, 1L).valid());
        assertFalse(service.quote("", "yearly", 6500, 1L).valid());
    }

    @Test
    void datesLimitAndPreviousUseAreEnforced() {
        Coupon k = coupon("percent", 10);
        k.setStartsAt(Instant.now().plus(1, ChronoUnit.DAYS));
        assertFalse(service.quote("SAVE", "yearly", 6500, 1L).valid());
        k.setStartsAt(null);
        k.setEndsAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        assertEquals("That code has expired.", service.quote("SAVE", "yearly", 6500, 1L).message());
        k.setEndsAt(null);
        k.setMaxRedemptions(5); k.setRedemptions(5);
        assertEquals("That code has been fully used.", service.quote("SAVE", "yearly", 6500, 1L).message());
        k.setMaxRedemptions(null);
        when(redemptions.existsByUserIdAndCouponId(1L, 7L)).thenReturn(true);
        assertEquals("You have already used that code.", service.quote("SAVE", "yearly", 6500, 1L).message());
        assertTrue(service.quote("SAVE", "yearly", 6500, 2L).valid());
    }

    @Test
    void redeemCountsOncePerMember() {
        coupon("percent", 10);
        when(coupons.countUse(7L)).thenReturn(1);
        assertTrue(service.redeem("save", 1L));
        verify(coupons).countUse(7L);
        when(redemptions.existsByUserIdAndCouponId(1L, 7L)).thenReturn(true);
        assertFalse(service.redeem("SAVE", 1L));
        verify(coupons, times(1)).countUse(7L);
    }
}
