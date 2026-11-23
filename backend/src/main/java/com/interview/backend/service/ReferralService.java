package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * "Invite 3 friends, get a week of Premium". Each friend who signs up with the link gets a week of Premium straight away;
 * the member who invited them earns a week for every {@value #REFERRALS_PER_REWARD}th friend. Counting stops at
 * MAX_REFERRALS friends (10 rewards, 70 days), which keeps self-referral farms small. A friend can't be referred by
 * themselves, and an unknown code is simply ignored.
 */
@Service
@RequiredArgsConstructor
public class ReferralService {

    public static final int REWARD_DAYS = 7, REFERRALS_PER_REWARD = 3, MAX_REWARDS = 10, MAX_REFERRALS = REFERRALS_PER_REWARD * MAX_REWARDS;
    private static final String ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";   // no look-alikes (0/o, 1/l/i)
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PremiumGrantService grants;

    public synchronized String codeFor(User u) {
        if (u.getReferralCode() != null) return u.getReferralCode();
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            code = sb.toString();
        } while (users.findByReferralCode(code).isPresent());
        u.setReferralCode(code);
        users.save(u);
        return code;
    }

    /** Called right after sign-up. Returns true when the friend was credited to the referrer (the friend's week is given; the referrer's only on every 3rd friend). */
    public synchronized boolean apply(User newUser, String code) {
        if (code == null || code.isBlank() || code.length() > 12 || newUser.getReferredBy() != null) return false;
        User referrer = users.findByReferralCode(code.trim().toLowerCase()).orElse(null);
        if (referrer == null || referrer.getId().equals(newUser.getId())) return false;
        if (users.countByReferredBy(referrer.getId()) >= MAX_REFERRALS) return false;
        newUser.setReferredBy(referrer.getId());
        users.save(newUser);
        grants.grantDays(newUser, REWARD_DAYS, "referral");
        if (users.countByReferredBy(referrer.getId()) % REFERRALS_PER_REWARD == 0) grants.grantDays(referrer, REWARD_DAYS, "referral");
        return true;
    }
}
