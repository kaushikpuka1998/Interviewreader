package com.interview.backend.dto;

import java.util.List;

// Request/response payloads for auth + progress.
public class AuthDtos {

    public record RegisterRequest(String email, String password, String name, String country, String city,
                                  String utmSource, String utmCampaign, String username, Boolean termsAccepted,
                                  String dateOfBirth, String guardianName, String guardianEmail, Boolean guardianConsent,
                                  Boolean adult) {}

    public record LoginRequest(String email, String password) {}

    public record AuthResponse(String token, String email, String name, boolean admin, boolean premium) {}

    // Guest progress optionally merged on login/register.
    public record ProgressPayload(List<String> visited, List<String> read) {}
}
