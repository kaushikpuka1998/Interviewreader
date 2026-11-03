package com.interview.backend.dto;

import java.util.List;

// Request/response payloads for auth + progress.
public class AuthDtos {

    public record RegisterRequest(String email, String password, String name, String country, String city,
                                  String utmSource, String utmCampaign, String username, Boolean termsAccepted,
                                  String dateOfBirth, String guardianName, String guardianEmail, Boolean guardianConsent,
                                  Boolean adult, String ref) {}

    public record LoginRequest(String email, String password) {}

    // "Sign in with Google": the ID token, plus the same consent fields as sign-up (used only for a new account).
    public record GoogleRequest(String credential, Boolean termsAccepted, Boolean adult, String guardianName,
                                String guardianEmail, Boolean guardianConsent, String utmSource, String utmCampaign, String ref) {}

    // The JWT is never in the body: it travels only in the HttpOnly session cookie.
    // accessExpiresAt (epoch ms) tells the page when to refresh; null on /auth/session.
    public record AuthResponse(String email, String name, boolean admin, boolean premium, Long accessExpiresAt, String picture) {}

    // Guest progress optionally merged on login/register.
    public record ProgressPayload(List<String> visited, List<String> read) {}
}
