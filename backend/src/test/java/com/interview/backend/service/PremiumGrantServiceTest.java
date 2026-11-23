package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Free Premium days (trial, referral rewards): stacking, lifetime safety, and who gets the "given by" marker. */
class PremiumGrantServiceTest {

    private UserRepository users;
    private BillingService billing;
    private PremiumGrantService service;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        billing = mock(BillingService.class);
        service = new PremiumGrantService(users, billing);
        user = new User();
        user.setEmail("m@example.com");
    }

    @Test
    void aMemberWithNoPremiumGetsTheDaysAndTheMarker() {
        service.grantDays(user, 3, "trial");
        assertTrue(user.getPremiumUntil().isAfter(Instant.now().plus(Duration.ofDays(2))));
        assertEquals("trial", user.getPremiumGrantedBy());
        assertNull(user.getPremiumPlan());
        verify(users).save(user);
        verify(billing).forgetPremium("m@example.com");
    }

    @Test
    void daysStackOnRunningPremiumWithoutTouchingTheMarker() {
        Instant running = Instant.now().plus(Duration.ofDays(10));
        user.setPremiumUntil(running);
        user.setPremiumPlan("monthly");
        service.grantDays(user, 5, "referral");
        assertEquals(running.plus(Duration.ofDays(5)), user.getPremiumUntil());
        assertEquals("monthly", user.getPremiumPlan(), "paid plan is kept");
        assertNull(user.getPremiumGrantedBy(), "paid time can't be revoked as a free grant");
    }

    @Test
    void lifetimeIsNeverTouched() {
        Instant forever = Instant.parse("2999-12-31T00:00:00Z");
        user.setPremiumUntil(forever);
        service.grantDays(user, 3, "trial");
        assertEquals(forever, user.getPremiumUntil());
        verify(users, never()).save(any());
    }

    @Test
    void anExpiredPassRestartsFromNow() {
        user.setPremiumUntil(Instant.now().minus(Duration.ofDays(30)));
        service.grantDays(user, 3, "trial");
        assertTrue(user.getPremiumUntil().isBefore(Instant.now().plus(Duration.ofDays(4))));
        assertEquals("trial", user.getPremiumGrantedBy());
    }
}
