package com.interview.backend.controller;

import com.interview.backend.dto.AuthDtos.LoginRequest;
import com.interview.backend.dto.AuthDtos.RegisterRequest;
import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailSendException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Sign-up, login, forgot/reset password: validation messages, status codes and what gets saved. */
class AuthControllerTest {

    private UserRepository users;
    private PasswordEncoder encoder;
    private AuthenticationManager authManager;
    private EmailService email;
    private SessionService sessions;
    private UsernameService usernames;
    private AuthController auth;
    private final MockHttpServletRequest http = new MockHttpServletRequest();
    private final MockHttpServletResponse res = new MockHttpServletResponse();

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        encoder = mock(PasswordEncoder.class);
        authManager = mock(AuthenticationManager.class);
        email = mock(EmailService.class);
        sessions = mock(SessionService.class);
        usernames = mock(UsernameService.class);
        auth = new AuthController(users, mock(BillingService.class), encoder, authManager, mock(ProgressService.class), email,
                sessions, mock(ReferralService.class), mock(GoogleAuthService.class), mock(GeoService.class), usernames);
        ReflectionTestUtils.setField(auth, "adminEmailsCsv", "boss@example.com");
        when(encoder.encode(any())).thenAnswer(i -> "hash:" + i.getArgument(0));
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        when(usernames.generate(any(), any())).thenReturn("alice");
        when(usernames.isAvailable(any())).thenReturn(true);
        when(sessions.startSession(any(), any(), any())).thenReturn(Instant.now().plusSeconds(900));
    }

    /** A valid adult sign-up; tests change one thing at a time. */
    private static RegisterRequest req(String mail, String pw, Boolean terms, Boolean adult) {
        return new RegisterRequest(mail, pw, "Alice", null, null, null, null, null, terms, null, null, null, null, adult, null);
    }

    private static String error(ResponseEntity<?> r) { return (String) ((Map<?, ?>) r.getBody()).get("error"); }

    // ---- register ----

    @Test
    void registersAnAdultAndStoresAHashedPassword() {
        ResponseEntity<?> r = auth.register(req(" Alice@Example.com ", "secret1", true, true), http, res);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        verify(users).save(argThat(u -> u.getEmail().equals("alice@example.com") && u.getPassword().equals("hash:secret1")
                && "alice".equals(u.getUsername())));
        verify(sessions).startSession(any(), any(), any());
    }

    @Test
    void termsMustBeAccepted() {
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req("a@b.com", "secret1", false, true), http, res).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req("a@b.com", "secret1", null, true), http, res).getStatusCode());
        verify(users, never()).save(any());
    }

    @Test
    void mustConfirmAdultOrGiveGuardianConsent() {
        ResponseEntity<?> r = auth.register(req("a@b.com", "secret1", true, null), http, res);
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        assertTrue(error(r).contains("18"));
    }

    @Test
    void aMinorNeedsAGuardianWithADifferentEmail() {
        RegisterRequest noGuardian = new RegisterRequest("kid@b.com", "secret1", "Kid", null, null, null, null, null, true, null, null, null, true, null, null);
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(noGuardian, http, res).getStatusCode());
        RegisterRequest sameEmail = new RegisterRequest("kid@b.com", "secret1", "Kid", null, null, null, null, null, true, null, "Mum", "kid@b.com", true, null, null);
        assertTrue(error(auth.register(sameEmail, http, res)).contains("different"));
        RegisterRequest ok = new RegisterRequest("kid@b.com", "secret1", "Kid", null, null, null, null, null, true, null, "Mum", "mum@b.com", true, null, null);
        assertEquals(HttpStatus.OK, auth.register(ok, http, res).getStatusCode());
        verify(users).save(argThat(u -> "Mum".equals(u.getGuardianName()) && u.getGuardianConsentAt() != null));
    }

    @Test
    void anOldDateOfBirthIsStillAcceptedButABadOneIsNot() {
        RegisterRequest bad = new RegisterRequest("a@b.com", "secret1", "A", null, null, null, null, null, true, "not-a-date", null, null, null, null, null);
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(bad, http, res).getStatusCode());
        RegisterRequest future = new RegisterRequest("a@b.com", "secret1", "A", null, null, null, null, null, true, "2999-01-01", null, null, null, null, null);
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(future, http, res).getStatusCode());
        RegisterRequest adult = new RegisterRequest("a@b.com", "secret1", "A", null, null, null, null, null, true, "1990-05-05", null, null, null, null, null);
        assertEquals(HttpStatus.OK, auth.register(adult, http, res).getStatusCode());
    }

    @Test
    void emailAndPasswordAreRequiredWithAtLeastSixCharacters() {
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req("a@b.com", "12345", true, true), http, res).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req("", "secret1", true, true), http, res).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req(null, "secret1", true, true), http, res).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(req("a@b.com", null, true, true), http, res).getStatusCode());
    }

    @Test
    void duplicateEmailIsAConflictAndSavesNothing() {
        when(users.existsByEmail("a@b.com")).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, auth.register(req("A@B.com", "secret1", true, true), http, res).getStatusCode());
        verify(users, never()).save(any());
    }

    @Test
    void aChosenUsernameMustBeValidAndFree() {
        RegisterRequest bad = new RegisterRequest("a@b.com", "secret1", "A", null, null, null, null, "9x", true, null, null, null, null, true, null);
        assertEquals(HttpStatus.BAD_REQUEST, auth.register(bad, http, res).getStatusCode());
        when(usernames.isAvailable("alice_w")).thenReturn(false);
        RegisterRequest taken = new RegisterRequest("a@b.com", "secret1", "A", null, null, null, null, "alice_w", true, null, null, null, null, true, null);
        assertEquals(HttpStatus.CONFLICT, auth.register(taken, http, res).getStatusCode());
    }

    // ---- login ----

    @Test
    void loginWithBadCredentialsIs401() {
        when(authManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
        ResponseEntity<?> r = auth.login(new LoginRequest("a@b.com", "wrong"), http, res);
        assertEquals(HttpStatus.UNAUTHORIZED, r.getStatusCode());
        assertEquals("Invalid email or password", error(r));
        verify(sessions, never()).startSession(any(), any(), any());
    }

    @Test
    void loginNormalisesTheEmailAndStartsASession() {
        User u = new User();
        u.setEmail("a@b.com");
        when(users.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        ResponseEntity<?> r = auth.login(new LoginRequest("  A@B.com ", "secret1"), http, res);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertNotNull(u.getLastLoginAt());
        verify(sessions).startSession(u, http, res);
    }

    @Test
    void loggingOutEndsTheSession() {
        assertEquals(HttpStatus.OK, auth.logout(http, res).getStatusCode());
        verify(sessions).endSession(http, res);
    }

    // ---- forgot / reset password ----

    @Test
    void forgotPasswordNeedsAnEmailAndDoesNotRevealWhetherItExists() {
        assertEquals(HttpStatus.BAD_REQUEST, auth.forgotPassword(Map.of("email", " ")).getStatusCode());
        when(users.findByEmail("nobody@b.com")).thenReturn(Optional.empty());
        ResponseEntity<?> r = auth.forgotPassword(Map.of("email", "nobody@b.com"));
        assertEquals(HttpStatus.OK, r.getStatusCode());
        verifyNoInteractions(email);
    }

    @Test
    void forgotPasswordStoresAnHourLongTokenAndEmailsIt() {
        User u = new User();
        u.setEmail("a@b.com");
        when(users.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertEquals(HttpStatus.OK, auth.forgotPassword(Map.of("email", "A@b.com")).getStatusCode());
        assertNotNull(u.getResetToken());
        assertTrue(u.getResetTokenExpiry().isAfter(Instant.now().plusSeconds(3500)));
        verify(email).sendPasswordResetEmail("a@b.com", u.getResetToken());
    }

    @Test
    void anEmailOutageIsReportedAs503() {
        User u = new User();
        when(users.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        doThrow(new MailSendException("smtp down")).when(email).sendPasswordResetEmail(any(), any());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, auth.forgotPassword(Map.of("email", "a@b.com")).getStatusCode());
    }

    @Test
    void resetPasswordValidatesTokenAndLength() {
        assertEquals(HttpStatus.BAD_REQUEST, auth.resetPassword(Map.of("token", "t", "password", "123")).getStatusCode());
        when(users.findByResetToken("nope")).thenReturn(Optional.empty());
        assertEquals(HttpStatus.BAD_REQUEST, auth.resetPassword(Map.of("token", "nope", "password", "secret1")).getStatusCode());
        User expired = new User();
        expired.setResetTokenExpiry(Instant.now().minusSeconds(1));
        when(users.findByResetToken("old")).thenReturn(Optional.of(expired));
        assertEquals(HttpStatus.BAD_REQUEST, auth.resetPassword(Map.of("token", "old", "password", "secret1")).getStatusCode());
    }

    @Test
    void resetPasswordChangesItClearsTheTokenAndSignsOutEveryDevice() {
        User u = new User();
        u.setId(9L);
        u.setResetToken("good");
        u.setResetTokenExpiry(Instant.now().plusSeconds(600));
        when(users.findByResetToken("good")).thenReturn(Optional.of(u));
        assertEquals(HttpStatus.OK, auth.resetPassword(Map.of("token", "good", "password", "newsecret")).getStatusCode());
        assertEquals("hash:newsecret", u.getPassword());
        assertNull(u.getResetToken());
        verify(sessions).endAllSessions(9L);
    }
}
