package com.interview.backend.service;

import com.interview.backend.entity.RefreshToken;
import com.interview.backend.entity.User;
import com.interview.backend.repository.RefreshTokenRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.util.CookieUtil;
import com.interview.backend.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Signed-in sessions: a short-lived access token (JWT, in the "token" cookie, checked on every request)
 * plus a long-lived refresh token (random, in the "refresh_token" cookie, sent only to /auth) that buys a
 * new access token when the old one expires.
 *
 * Refresh tokens rotate: each use returns a new one and retires the old. If a retired token comes back,
 * someone kept a copy, so the whole login (family) is revoked and both parties must sign in again.
 * The exception is a reuse within a few seconds, which is two tabs refreshing at once, not theft.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    /** Two tabs can refresh with the same token at once; a reuse this soon after rotation is that race. */
    private static final Duration ROTATION_GRACE = Duration.ofSeconds(30);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final JwtUtil jwt;
    private final CookieUtil cookies;

    @Value("${app.jwt.refresh-days:30}")
    private long refreshDays;

    /** After a successful login or sign-up: a new login (family) with fresh access and refresh cookies. Returns the access expiry. */
    public Instant startSession(User user, HttpServletRequest req, HttpServletResponse res) {
        return issue(user, UUID.randomUUID().toString(), req, res);
    }

    // ponytail: synchronized = one refresh at a time in this JVM, so two tabs can't both rotate the same token.
    // Running several backend instances would need a row lock (SELECT ... FOR UPDATE) instead.
    /** Swaps a refresh token for new cookies. Empty when the token is missing, unknown, expired or revoked. */
    public synchronized Optional<SignedIn> refresh(HttpServletRequest req, HttpServletResponse res) {
        String raw = cookies.getRefreshToken(req);
        RefreshToken t = raw == null ? null : tokens.findByTokenHash(hash(raw)).orElse(null);
        Instant now = Instant.now();
        if (t == null || t.getRevokedAt() != null || t.getExpiresAt().isBefore(now)) return Optional.empty();
        if (t.getReplacedAt() != null && t.getReplacedAt().plus(ROTATION_GRACE).isBefore(now)) {
            log.warn("Refresh token reused after rotation; revoking login family {} of user {}", t.getFamilyId(), t.getUserId());
            tokens.revokeFamily(t.getFamilyId(), now);
            return Optional.empty();
        }
        User user = users.findById(t.getUserId()).orElse(null);
        if (user == null) return Optional.empty();
        if (t.getReplacedAt() == null) {
            t.setReplacedAt(now);
            tokens.save(t);
        }
        return Optional.of(new SignedIn(user, issue(user, t.getFamilyId(), req, res)));
    }

    /** Logout: ends this device's login and clears both cookies. */
    public void endSession(HttpServletRequest req, HttpServletResponse res) {
        String raw = cookies.getRefreshToken(req);
        if (raw != null) tokens.findByTokenHash(hash(raw)).ifPresent(t -> tokens.revokeFamily(t.getFamilyId(), Instant.now()));
        cookies.clearSessionCookies(req, res);
    }

    /** Ends every login of this user (password reset). Access tokens already out expire within minutes. */
    public void endAllSessions(Long userId) {
        tokens.revokeAllForUser(userId, Instant.now());
    }

    // Keeps the table small; expired tokens are useless anyway.
    @Scheduled(cron = "0 30 3 * * *")
    public void deleteExpired() {
        int n = tokens.deleteExpiredBefore(Instant.now().minus(Duration.ofDays(1)));
        if (n > 0) log.info("Deleted {} expired refresh tokens", n);
    }

    public record SignedIn(User user, Instant accessExpiresAt) {}

    private Instant issue(User user, String family, HttpServletRequest req, HttpServletResponse res) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Duration refreshTtl = Duration.ofDays(refreshDays);

        RefreshToken t = new RefreshToken();
        t.setUserId(user.getId());
        t.setTokenHash(hash(raw));
        t.setFamilyId(family);
        t.setExpiresAt(Instant.now().plus(refreshTtl));
        tokens.save(t);

        cookies.setAccessCookie(res, jwt.generateToken(user.getEmail()), jwt.accessTtl());
        cookies.setRefreshCookie(req, res, raw, refreshTtl);
        return Instant.now().plus(jwt.accessTtl());
    }

    private static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
