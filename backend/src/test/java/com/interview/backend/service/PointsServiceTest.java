package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.PointEventRepository;
import com.interview.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** The daily streak: continuing, restarting, the Premium freeze, and when a streak counts as ended. */
class PointsServiceTest {

    private BillingService billing;
    private PointsService service;
    private final LocalDate today = LocalDate.now(PointsService.ZONE);

    @BeforeEach
    void setUp() {
        billing = mock(BillingService.class);
        service = new PointsService(mock(PointEventRepository.class), mock(UserRepository.class), billing);
    }

    private User user(Integer count, LocalDate last) {
        User u = new User();
        u.setId(1L);
        u.setEmail("m@example.com");
        u.setStreakCount(count);
        u.setStreakLastDate(last);
        return u;
    }

    @Test
    void theFirstCheckInStartsAStreakOfOne() {
        User u = user(null, null);
        service.checkIn(u);
        assertEquals(1, u.getStreakCount());
        assertEquals(today, u.getStreakLastDate());
    }

    @Test
    void checkingInAgainTheSameDayChangesNothing() {
        User u = user(5, today);
        service.checkIn(u);
        assertEquals(5, u.getStreakCount());
    }

    @Test
    void yesterdayExtendsTheStreakAndUpdatesTheBest() {
        User u = user(5, today.minusDays(1));
        u.setStreakBest(5);
        service.checkIn(u);
        assertEquals(6, u.getStreakCount());
        assertEquals(6, u.getStreakBest());
    }

    @Test
    void aMissedDayRestartsTheStreakForAFreeMember() {
        User u = user(20, today.minusDays(2));
        u.setStreakBest(20);
        service.checkIn(u);
        assertEquals(1, u.getStreakCount());
        assertEquals(20, u.getStreakBest(), "the best streak is kept");
        assertNull(u.getStreakFreezeUsedOn());
    }

    @Test
    void premiumFreezeCoversOneMissedDay() {
        User u = user(20, today.minusDays(2));
        when(billing.isPremium(u)).thenReturn(true);
        Map<String, Object> out = service.checkIn(u);
        assertEquals(21, u.getStreakCount());
        assertEquals(today, u.getStreakFreezeUsedOn());
        assertEquals(true, out.get("freezeUsed"));
    }

    @Test
    void theFreezeIsOnceEveryThirtyDays() {
        User u = user(20, today.minusDays(2));
        u.setStreakFreezeUsedOn(today.minusDays(10));
        when(billing.isPremium(u)).thenReturn(true);
        service.checkIn(u);
        assertEquals(1, u.getStreakCount());
        User later = user(20, today.minusDays(2));
        later.setStreakFreezeUsedOn(today.minusDays(31));
        when(billing.isPremium(later)).thenReturn(true);
        service.checkIn(later);
        assertEquals(21, later.getStreakCount());
    }

    @Test
    void theFreezeNeedsAStreakOfThreeAndOnlyCoversOneDay() {
        User shortStreak = user(2, today.minusDays(2));
        when(billing.isPremium(shortStreak)).thenReturn(true);
        service.checkIn(shortStreak);
        assertEquals(1, shortStreak.getStreakCount());
        User twoDays = user(20, today.minusDays(3));
        when(billing.isPremium(twoDays)).thenReturn(true);
        service.checkIn(twoDays);
        assertEquals(1, twoDays.getStreakCount());
    }

    @Test
    void aStreakWhoseLastDayIsBeforeYesterdayShowsAsEnded() {
        assertEquals(0, service.summary(user(20, today.minusDays(2))).get("streak"));
        assertEquals(20, service.summary(user(20, today.minusDays(1))).get("streak"));
        assertEquals(20, service.summary(user(20, today)).get("streak"));
        assertEquals(0, service.summary(user(null, null)).get("streak"));
    }
}
