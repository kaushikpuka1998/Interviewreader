package com.interview.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP fixed-window rate limiter for auth endpoints (brute-force / credential-stuffing defense).
 * ponytail: in-memory + per-instance. Fine for one node; move counters to Redis if you scale to
 * multiple backend instances and need a shared limit.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private final int maxRequests;
    private final long windowMs;
    // Public reads (questions, coding problems, /public/**): a generous per-IP cap so a script can't bulk-download the catalogue.
    private final int readMax;
    // key -> [windowStartMillis, count]
    private final ConcurrentHashMap<String, long[]> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(int maxRequests, long windowSeconds, int readMaxRequests) {
        this.readMax = readMaxRequests;
        this.maxRequests = maxRequests;
        this.windowMs = windowSeconds * 1000L;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // Only limit state-changing auth calls; let preflight and everything else pass.
        // Match on the request URI so it works regardless of context-path handling.
        String uri = request.getRequestURI(); // e.g. /api/auth/login
        // Session refresh is exempt: it needs a 256-bit secret (nothing to brute-force) and runs every few
        // minutes per open tab, which would exhaust the limit for people sharing an IP.
        boolean limited = "POST".equalsIgnoreCase(request.getMethod())
                && uri != null && uri.contains("/auth/") && !uri.endsWith("/auth/refresh");
        boolean scrape = !limited && "GET".equalsIgnoreCase(request.getMethod()) && uri != null
                && (uri.contains("/questions") || uri.contains("/coding-problems") || uri.contains("/public/"));
        if (!limited && !scrape) {
            chain.doFilter(request, response);
            return;
        }
        int max = limited ? maxRequests : readMax;

        String key = clientIp(request) + "|" + (limited ? uri : "read");
        long now = System.currentTimeMillis();

        long[] state = buckets.compute(key, (k, v) -> {
            if (v == null || now - v[0] >= windowMs) {
                return new long[]{now, 1}; // new window
            }
            v[1]++; // same window
            return v;
        });

        // Cheap bound on map growth without a scheduler.
        if (buckets.size() > 10_000) buckets.clear();

        if (state[1] > max) {
            long retryAfter = Math.max(1, (windowMs - (now - state[0])) / 1000);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"Too many requests. Try again in " + retryAfter + "s.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    // Honor the proxy header (Railway/AWS run behind a load balancer), else the socket address.
    public static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
