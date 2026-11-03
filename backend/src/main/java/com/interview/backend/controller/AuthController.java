package com.interview.backend.controller;

import com.interview.backend.dto.AuthDtos.*;
import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.EmailService;
import com.interview.backend.service.ProgressService;
import com.interview.backend.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.interview.backend.filter.RateLimitFilter;
import com.interview.backend.service.GeoService;
import com.interview.backend.service.LocationRules;
import com.interview.backend.service.UsernameService;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final com.interview.backend.service.BillingService billing;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final ProgressService progressService;
    private final EmailService emailService;
    private final SessionService sessions;
    private final com.interview.backend.service.ReferralService referrals;
    private final com.interview.backend.service.GoogleAuthService google;
    private final GeoService geo;
    private final com.interview.backend.service.UsernameService usernames;

    /** Live check for the signup form: is this username free? */
    @GetMapping("/username-available")
    public ResponseEntity<Map<String, Object>> usernameAvailable(@RequestParam String username) {
        try {
            String u = UsernameService.validate(username);
            return ResponseEntity.ok(Map.of("available", usernames.isAvailable(u), "username", u));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("available", false, "error", e.getMessage()));
        }
    }

    @Value("${app.admin.emails:}")
    private String adminEmailsCsv;

    private boolean isAdmin(String email) {
        for (String a : adminEmailsCsv.split(",")) {
            if (a.trim().equalsIgnoreCase(email)) return true;
        }
        return false;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req, HttpServletRequest http, HttpServletResponse response) {
        if (!Boolean.TRUE.equals(req.termsAccepted())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please accept the Terms and Privacy notice to create an account."));
        }
        // Members confirm they are 18+ with a checkbox; under-18s go through guardian consent instead.
        // A date of birth is still accepted from older clients.
        java.time.LocalDate dob = null;
        boolean minor;
        if (req.dateOfBirth() != null && !req.dateOfBirth().isBlank()) {
            try {
                dob = java.time.LocalDate.parse(req.dateOfBirth());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Please enter a valid date of birth."));
            }
            int age = java.time.Period.between(dob, java.time.LocalDate.now()).getYears();
            if (dob.isAfter(java.time.LocalDate.now()) || age > 120) {
                return ResponseEntity.badRequest().body(Map.of("error", "Please enter a valid date of birth."));
            }
            minor = age < 18;
        } else if (Boolean.TRUE.equals(req.adult())) {
            minor = false;
        } else if (Boolean.TRUE.equals(req.guardianConsent())) {
            minor = true;
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Please confirm you are 18 or older, or add a parent or guardian's consent."));
        }
        if (minor && (req.guardianName() == null || req.guardianName().isBlank()
                || req.guardianEmail() == null || !req.guardianEmail().contains("@")
                || !Boolean.TRUE.equals(req.guardianConsent()))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Users under 18 need a parent or guardian's name, email and consent."));
        }
        if (minor && req.email() != null && req.guardianEmail().trim().equalsIgnoreCase(req.email().trim())) {
            return ResponseEntity.badRequest().body(Map.of("error", "The parent or guardian's email must be different from yours."));
        }
        if (req.email() == null || req.password() == null || req.email().isBlank() || req.password().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and a password of at least 6 characters are required"));
        }
        // Location is optional at sign-up; when left out it is filled in from the IP (resolveFromIp below).
        LocationRules.Location loc = null;
        if (!isBlank(req.country()) || !isBlank(req.city())) {
            try {
                loc = LocationRules.validate(req.country(), req.city());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already registered"));
        }
        String username;
        try {
            username = req.username() == null || req.username().isBlank()
                    ? usernames.generate(req.name(), email)
                    : UsernameService.validate(req.username());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        if (req.username() != null && !req.username().isBlank() && !usernames.isAvailable(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "That username is taken"));
        }
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setName(req.name());
        user.setDateOfBirth(dob);
        if (minor) {
            user.setGuardianName(trimTo(req.guardianName().trim(), 100));
            user.setGuardianEmail(trimTo(req.guardianEmail().trim().toLowerCase(), 150));
            user.setGuardianConsentAt(Instant.now());
        }
        user.setLastLoginAt(Instant.now());
        if (loc != null) GeoService.applyUserLocation(user, loc.country(), loc.city());
        user.setUtmSource(trimTo(req.utmSource(), 100));
        user.setUtmCampaign(trimTo(req.utmCampaign(), 100));
        user = userRepository.save(user);
        usernames.taken(username);
        referrals.apply(user, req.ref());   // "invite a friend": both get a week of Premium
        geo.resolveFromIp(user.getId(), RateLimitFilter.clientIp(http));

        Instant accessExpires = sessions.startSession(user, http, response);
        return ResponseEntity.ok(authResponse(user, accessExpires));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletRequest http, HttpServletResponse response) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, req.password()));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid email or password"));
        }
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        geo.resolveFromIp(user.getId(), RateLimitFilter.clientIp(http));
        Instant accessExpires = sessions.startSession(user, http, response);
        return ResponseEntity.ok(authResponse(user, accessExpires));
    }

    /** Which sign-in options the page should show. The Google client id is public by design. */
    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return Map.of("googleClientId", google.enabled() ? google.clientId() : "");
    }

    /**
     * Sign in with Google. A known email signs straight in (Google has verified the address, so this also
     * works for accounts that were created with a password). A new email becomes an account through the
     * normal sign-up rules, so it needs the same Terms and age (or guardian) consent.
     */
    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody GoogleRequest req, HttpServletRequest http, HttpServletResponse response) {
        var who = google.verify(req.credential()).orElse(null);
        if (who == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Google sign-in failed. Please try again."));
        }
        User user = userRepository.findByEmail(who.email()).orElse(null);
        if (user != null) {
            user.setLastLoginAt(Instant.now());
            if (isBlank(user.getName()) && who.name() != null) user.setName(trimTo(who.name(), 100));
            if (who.picture() != null) user.setGooglePicture(who.picture());   // follows the Google account; an uploaded picture still wins
            userRepository.save(user);
            geo.resolveFromIp(user.getId(), RateLimitFilter.clientIp(http));
            return ResponseEntity.ok(authResponse(user, sessions.startSession(user, http, response)));
        }
        boolean consented = Boolean.TRUE.equals(req.termsAccepted())
                && (Boolean.TRUE.equals(req.adult()) || Boolean.TRUE.equals(req.guardianConsent()));
        if (!consented) {
            return ResponseEntity.badRequest().body(Map.of("error", "To create your account, confirm you are 18 or older and accept the Terms.",
                    "consentRequired", true));
        }
        // No password is ever typed; a random one keeps the column filled. "Forgot password" can set a real one.
        var created = register(new RegisterRequest(who.email(), UUID.randomUUID().toString(), trimTo(who.name(), 100), null, null,
                req.utmSource(), req.utmCampaign(), null, true, null, req.guardianName(), req.guardianEmail(),
                req.guardianConsent(), req.adult(), req.ref()), http, response);
        if (who.picture() != null && created.getStatusCode().is2xxSuccessful()) {
            userRepository.findByEmail(who.email()).ifPresent(u -> { u.setGooglePicture(who.picture()); userRepository.save(u); });
            // The sign-up response was built before the picture was saved: hand the page the picture now so it shows at once.
            if (created.getBody() instanceof AuthResponse r)
                return ResponseEntity.status(created.getStatusCode()).body(new AuthResponse(r.email(), r.name(), r.admin(), r.premium(), r.accessExpiresAt(), who.picture()));
        }
        return created;
    }

    /** One-click unsubscribe from new-question emails. Public: the HMAC signature is the auth. */
    @GetMapping(value = "/unsubscribe", produces = "text/plain")
    public ResponseEntity<String> unsubscribe(@RequestParam String email, @RequestParam String sig) {
        if (!emailService.isValidUnsubscribe(email, sig))
            return ResponseEntity.badRequest().body("Invalid unsubscribe link.");
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setEmailOptOut(true);
            userRepository.save(u);
        });
        return ResponseEntity.ok("You've been unsubscribed from new-question emails.");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimTo(String s, int max) {
        if (s == null || s.isBlank()) return null;
        s = s.trim();
        return s.length() > max ? s.substring(0, max) : s;
    }

    /** The signed-in member behind the session cookie, so the page can tell a live session from an expired one. */
    @GetMapping("/session")
    public ResponseEntity<?> session(java.security.Principal principal) {
        User user = principal == null ? null : userRepository.findByEmail(principal.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not signed in"));
        return ResponseEntity.ok(authResponse(user, null));
    }

    /** Swaps the refresh cookie for a new access + refresh cookie pair (the old refresh token is retired). */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest http, HttpServletResponse response) {
        return sessions.refresh(http, response)
                .<ResponseEntity<?>>map(s -> ResponseEntity.ok(authResponse(s.user(), s.accessExpiresAt())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Session expired, please sign in again")));
    }

    private AuthResponse authResponse(User user, Instant accessExpires) {
        return new AuthResponse(user.getEmail(), user.getName(), isAdmin(user.getEmail()), billing.isPremium(user),
                accessExpires == null ? null : accessExpires.toEpochMilli(), user.effectivePicture());
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest http, HttpServletResponse response) {
        sessions.endSession(http, response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> req) {
        String email = req.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }
        email = email.trim().toLowerCase();

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent"));
        }

        String resetToken = UUID.randomUUID().toString();
        user.setResetToken(resetToken);
        user.setResetTokenExpiry(Instant.now().plusSeconds(3600)); // 1 hour
        userRepository.save(user);

        try {
            emailService.sendPasswordResetEmail(email, resetToken);
        } catch (MailException e) {
            // SMTP down/misconfigured — say so instead of an opaque 500, and keep the cause in the logs.
            log.error("Password reset email to {} failed: {}", email, e.toString());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "We couldn't send the reset email right now. Please try again later."));
        }

        return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent"));
    }

    private String getDailyExportCode() {
        String today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString();
        int codeInt = Math.abs((today + "-interview-export-secret").hashCode()) % 1000000;
        return String.format("%06d", codeInt);
    }

    @PostMapping("/export-code/request")
    public ResponseEntity<?> requestExportCode(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String email = principal.getName();
        if (!isAdmin(email)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        String code = getDailyExportCode();
        emailService.sendExportCodeEmail(email, code);
        return ResponseEntity.ok(Map.of("message", "Export code sent to your email"));
    }

    @PostMapping("/export-code/verify")
    public ResponseEntity<?> verifyExportCode(@RequestBody Map<String, String> req, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String email = principal.getName();
        if (!isAdmin(email)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        String provided = req.get("code");
        String expected = getDailyExportCode();
        if (expected.equals(provided)) {
            return ResponseEntity.ok(Map.of("valid", true));
        } else {
            return ResponseEntity.ok(Map.of("valid", false));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> req) {
        String token = req.get("token");
        String newPassword = req.get("password");

        if (token == null || newPassword == null || newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid token and password (min 6 chars) required"));
        }

        User user = userRepository.findByResetToken(token).orElse(null);

        if (user == null || user.getResetTokenExpiry() == null || Instant.now().isAfter(user.getResetTokenExpiry())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired reset token"));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
        sessions.endAllSessions(user.getId());   // a reset password signs out every device

        return ResponseEntity.ok(Map.of("message", "Password reset successful"));
    }
}
