package com.interview.backend.service;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * "Invite a friend, you both get a week of Premium". The friend must sign up with the link; the reward is given once
 * per new account, and one member can earn it at most MAX_REWARDS times (70 days), which keeps self-referral
 * farms small. A friend can't be referred by themselves, and an unknown code is simply ignored.
 */
@Service
@RequiredArgsConstructor
public class ReferralService {

    public static final int REWARD_DAYS = 7, MAX_REWARDS = 10;
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

    /** Called right after sign-up. Returns true when the reward was given. */
    public boolean apply(User newUser, String code) {
        if (code == null || code.isBlank() || code.length() > 12 || newUser.getReferredBy() != null) return false;
        User referrer = users.findByReferralCode(code.trim().toLowerCase()).orElse(null);
        if (referrer == null || referrer.getId().equals(newUser.getId())) return false;
        if (users.countByReferredBy(referrer.getId()) >= MAX_REWARDS) return false;
        newUser.setReferredBy(referrer.getId());
        users.save(newUser);
        grants.grantDays(newUser, REWARD_DAYS, "referral");
        grants.grantDays(referrer, REWARD_DAYS, "referral");
        return true;
    }
}
