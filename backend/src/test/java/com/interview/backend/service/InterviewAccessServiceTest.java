package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.MockInterviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Mock interviews: which allowance pays for a booking (free period, Premium's monthly ones, then a plan), and the quota shown to the member. */
class InterviewAccessServiceTest {

    private MockInterviewRepository interviews;
    private BillingService billing;
    private User user;

    @BeforeEach
    void setUp() {
        interviews = mock(MockInterviewRepository.class);
        billing = mock(BillingService.class);
        user = new User();
        user.setId(5L);
        user.setEmail("c@example.com");
        when(billing.interviewPlans()).thenReturn(java.util.List.of());
    }

    private InterviewAccessService service(String freeUntil) { return new InterviewAccessService(interviews, billing, freeUntil, 6); }

    private static final String ENDED = "2020-01-01T00:00:00+05:30", FUTURE = "2999-01-01T00:00:00+05:30";

    @Test
    void adminsAreUnlimitedAndEveryoneIsFreeDuringTheLaunchPeriod() {
        when(billing.isAdmin(user)).thenReturn(true);
        assertEquals(InterviewAccessService.ADMIN, service(ENDED).charge(user));
        when(billing.isAdmin(user)).thenReturn(false);
        assertEquals(InterviewAccessService.FREE, service(FUTURE).charge(user));
        assertTrue(service(FUTURE).freePeriod());
        assertFalse(service(ENDED).freePeriod());
    }

    @Test
    void premiumMembersUseTheirMonthlyInterviewsFirst() {
        when(billing.isPremium(user)).thenReturn(true);
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PREMIUM), any(Instant.class))).thenReturn(5L);
        assertEquals(InterviewAccessService.PREMIUM, service(ENDED).charge(user));
    }

    @Test
    void afterPremiumIsUsedUpThePlanPays() {
        when(billing.isPremium(user)).thenReturn(true);
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PREMIUM), any(Instant.class))).thenReturn(6L);
        when(billing.activeInterviewPlan(user)).thenReturn("i5");
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PLAN), any())).thenReturn(4L);
        assertEquals(InterviewAccessService.PLAN, service(ENDED).charge(user));
    }

    @Test
    void outOfInterviewsWhenNothingIsLeft() {
        when(billing.isPremium(user)).thenReturn(true);
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PREMIUM), any(Instant.class))).thenReturn(6L);
        when(billing.activeInterviewPlan(user)).thenReturn("i5");
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PLAN), any())).thenReturn(5L);
        assertThrows(InterviewAccessService.OutOfInterviews.class, () -> service(ENDED).charge(user));
    }

    @Test
    void aFreeMemberWithNoPlanCannotBookAfterTheLaunchPeriod() {
        assertThrows(InterviewAccessService.OutOfInterviews.class, () -> service(ENDED).charge(user));
        Map<String, Object> q = service(ENDED).quota(user);
        assertEquals(false, q.get("canRequest"));
        assertEquals(false, q.get("premium"));
        assertEquals(0L, q.get("premiumLeft"));
    }

    @Test
    void quotaReportsWhatIsLeft() {
        when(billing.isPremium(user)).thenReturn(true);
        when(interviews.countUsed(eq(5L), eq(InterviewAccessService.PREMIUM), any(Instant.class))).thenReturn(2L);
        Map<String, Object> q = service(ENDED).quota(user);
        assertEquals(true, q.get("canRequest"));
        assertEquals(4L, q.get("premiumLeft"));
        assertEquals(6, q.get("premiumMonthly"));
    }

    @Test
    void adminQuotaIsUnlimited() {
        when(billing.isAdmin(user)).thenReturn(true);
        Map<String, Object> q = service(ENDED).quota(user);
        assertEquals(true, q.get("unlimited"));
        assertEquals(true, q.get("canRequest"));
    }
}
