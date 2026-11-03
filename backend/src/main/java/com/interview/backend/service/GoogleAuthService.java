package com.interview.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;

/**
 * Checks a Google ID token (the credential "Sign in with Google" hands the page) and returns who it belongs to.
 * Google's tokeninfo endpoint verifies the signature and expiry; we then require that the token was issued for
 * our client id, by Google, for a verified email address.
 */
@Slf4j
@Service
public class GoogleAuthService {

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    /** OAuth client id from Google Cloud Console. Blank turns Google sign-in off. Public: the page needs it too. */
    @Value("${app.google.client-id:}")
    private String clientId;

    // ponytail: tokeninfo is one HTTP call per sign-in; verify locally against Google's JWKs if sign-ins get busy.
    @Value("${app.google.tokeninfo-url:https://oauth2.googleapis.com/tokeninfo}")
    private String tokeninfoUrl;

    public record GoogleUser(String email, String name) {}

    public boolean enabled() {
        return !clientId.isBlank();
    }

    public String clientId() {
        return clientId;
    }

    public Optional<GoogleUser> verify(String idToken) {
        if (!enabled() || idToken == null || idToken.isBlank()) return Optional.empty();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(tokeninfoUrl + "?id_token=" + URLEncoder.encode(idToken, StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return Optional.empty();
            JsonNode t = JSON.readTree(res.body());
            String email = t.path("email").asText("");
            boolean ok = clientId.equals(t.path("aud").asText())
                    && ISSUERS.contains(t.path("iss").asText())
                    && "true".equals(t.path("email_verified").asText())
                    && t.path("exp").asLong(0) * 1000 > System.currentTimeMillis()
                    && !email.isBlank();
            if (!ok) return Optional.empty();
            String name = t.path("name").asText("");
            return Optional.of(new GoogleUser(email.trim().toLowerCase(), name.isBlank() ? null : name));
        } catch (Exception e) {
            log.warn("Google token check failed: {}", e.toString());
            return Optional.empty();
        }
    }
}
