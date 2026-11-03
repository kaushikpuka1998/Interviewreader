package com.interview.backend.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
// Session cookies are HttpOnly (page scripts can't read them), Secure (HTTPS only) and SameSite=Lax, so other
// sites can't send them on cross-site POST/PUT/DELETE requests (CSRF). The frontend (interviewreader.cloud) and
// the API (api.interviewreader.cloud) are the same site, so Lax still lets the app's own requests carry them.
//   token          short-lived access JWT, sent with every API request (Path=/)
//   refresh_token  long-lived refresh token, sent only to the auth endpoints (Path=<context>/auth)
public class CookieUtil {

    private static final String ACCESS = "token", REFRESH = "refresh_token";

    public void setAccessCookie(HttpServletResponse response, String token, Duration ttl) {
        add(response, ACCESS, token, "/", ttl);
    }

    public void setRefreshCookie(HttpServletRequest request, HttpServletResponse response, String token, Duration ttl) {
        add(response, REFRESH, token, refreshPath(request), ttl);
    }

    public void clearSessionCookies(HttpServletRequest request, HttpServletResponse response) {
        add(response, ACCESS, "", "/", Duration.ZERO);
        add(response, REFRESH, "", refreshPath(request), Duration.ZERO);
    }

    public String getTokenFromCookie(HttpServletRequest request) {
        return read(request, ACCESS);
    }

    public String getRefreshToken(HttpServletRequest request) {
        return read(request, REFRESH);
    }

    private static String refreshPath(HttpServletRequest request) {
        return request.getContextPath() + "/auth";   // e.g. /api/auth
    }

    private static void add(HttpServletResponse response, String name, String value, String path, Duration ttl) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(true)
                .path(path)
                .maxAge(ttl)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static String read(HttpServletRequest request, String name) {
        if (request.getCookies() != null)
            for (Cookie c : request.getCookies())
                if (name.equals(c.getName())) return c.getValue();
        return null;
    }
}
