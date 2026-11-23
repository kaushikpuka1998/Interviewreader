package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Referrals: the friend gets a week at sign-up; the referrer gets a week for every 3rd friend, up to a cap. */
class ReferralServiceTest {

    private UserRepository users;
    private PremiumGrantService grants;
    private ReferralService service;
    private User referrer, friend;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        grants = mock(PremiumGrantService.class);
        service = new ReferralService(users, grants);
        referrer = new User(); referrer.setId(1L); referrer.setReferralCode("abc23xyz");
        friend = new User(); friend.setId(2L);
        when(users.findByReferralCode("abc23xyz")).thenReturn(Optional.of(referrer));
    }

    private void friendsAfterThisOne(long n) {
        // first count = before this friend joins (cap check), second = after (reward check)
        when(users.countByReferredBy(1L)).thenReturn(n - 1, n);
    }

    @Test
    void theFriendAlwaysGetsAWeekButTheReferrerOnlyOnTheThirdFriend() {
        friendsAfterThisOne(1);
        assertTrue(service.apply(friend, "abc23xyz"));
        verify(grants).grantDays(friend, ReferralService.REWARD_DAYS, "referral");
        verify(grants, never()).grantDays(eq(referrer), anyInt(), any());
        assertEquals(1L, friend.getReferredBy());
    }

    @Test
    void thirdAndSixthFriendsEarnTheReferrerAWeek() {
        for (long n : new long[]{3, 6, 30}) {
            reset(grants);
            User f = new User(); f.setId(10L + n);
            friendsAfterThisOne(n);
            assertTrue(service.apply(f, "abc23xyz"), "friend " + n);
            verify(grants).grantDays(referrer, ReferralService.REWARD_DAYS, "referral");
        }
    }

    @Test
    void secondFourthAndFifthFriendsDoNotReward() {
        for (long n : new long[]{2, 4, 5}) {
            reset(grants);
            User f = new User(); f.setId(10L + n);
            friendsAfterThisOne(n);
            service.apply(f, "abc23xyz");
            verify(grants, never()).grantDays(eq(referrer), anyInt(), any());
        }
    }

    @Test
    void nothingIsGivenPastTheCap() {
        when(users.countByReferredBy(1L)).thenReturn((long) ReferralService.MAX_REFERRALS);
        assertFalse(service.apply(friend, "abc23xyz"));
        verifyNoInteractions(grants);
        assertNull(friend.getReferredBy());
    }

    @Test
    void ignoresBadCodesSelfReferralAndAlreadyReferredAccounts() {
        assertFalse(service.apply(friend, null));
        assertFalse(service.apply(friend, " "));
        assertFalse(service.apply(friend, "waytoolongcode1"));
        assertFalse(service.apply(friend, "nosuchcd"));
        assertFalse(service.apply(referrer, "abc23xyz"), "can't refer yourself");
        friend.setReferredBy(99L);
        assertFalse(service.apply(friend, "abc23xyz"), "already referred by someone");
        verifyNoInteractions(grants);
    }

    @Test
    void codeIsCaseInsensitive() {
        friendsAfterThisOne(1);
        assertTrue(service.apply(friend, " ABC23XYZ "));
    }
}
