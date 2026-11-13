package com.interview.backend.config;

import com.interview.backend.entity.ServerError;
import com.interview.backend.repository.ServerErrorRepository;
import com.interview.backend.service.EmailService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Records every request that ends in a 5xx (a thrown exception or an explicit 5xx response) and emails the admin(s) about it.
 * The email is throttled: one per endpoint and error type every 15 minutes, so a broken page cannot flood the inbox.
 * Logging never changes the response and never throws.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ServerErrorLogger extends OncePerRequestFilter {

    private static final long QUIET_MS = 15 * 60 * 1000;

    private final ServerErrorRepository errors;
    private final EmailService email;
    private final Map<String, Long> lastMailed = new ConcurrentHashMap<>();

    @Value("${app.admin.emails:}")
    private String adminEmailsCsv;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String p = request.getRequestURI();
        return p.contains("/analytics/") || p.endsWith("/health") || p.endsWith("/error");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Throwable thrown = null;
        try {
            chain.doFilter(req, res);
        } catch (ServletException | IOException | RuntimeException e) {
            thrown = e;
            throw e;
        } finally {
            if (thrown != null || res.getStatus() >= 500) record(req, res.getStatus() >= 500 ? res.getStatus() : 500, thrown);
        }
    }

    private void record(HttpServletRequest req, int status, Throwable thrown) {
        try {
            Throwable root = thrown;
            while (root != null && root.getCause() != null && root.getCause() != root) root = root.getCause();
            if (root == null && req.getAttribute("jakarta.servlet.error.exception") instanceof Throwable t) root = t;
            String type = root == null ? "HTTP " + status : root.getClass().getName();
            String msg = root == null ? "The server answered with status " + status : String.valueOf(root.getMessage());
            var auth = SecurityContextHolder.getContext().getAuthentication();
            String user = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName()) ? auth.getName() : null;

            ServerError e = new ServerError();
            e.setMethod(req.getMethod());
            e.setPath(cut(req.getRequestURI(), 300));
            e.setStatus(status);
            e.setExceptionType(cut(type, 160));
            e.setMessage(cut(msg, 500));
            e.setUserEmail(user);
            errors.save(e);
            log.error("5xx on {} {} ({}): {}", req.getMethod(), req.getRequestURI(), type, msg);

            String key = req.getMethod() + " " + req.getRequestURI() + " " + type;
            long now = System.currentTimeMillis();
            Long last = lastMailed.get(key);
            if (last == null || now - last > QUIET_MS) {
                lastMailed.put(key, now);
                if (lastMailed.size() > 500) lastMailed.entrySet().removeIf(en -> now - en.getValue() > QUIET_MS);
                notifyAdmins(e);
            }
        } catch (Exception ignored) {
            // a failed log must never turn into a second error
        }
    }

    private void notifyAdmins(ServerError e) {
        String body = "A request failed with a server error.\n\n"
                + "Endpoint: " + e.getMethod() + " " + e.getPath() + "\n"
                + "Status: " + e.getStatus() + "\n"
                + "Error: " + e.getExceptionType() + "\n"
                + "Message: " + e.getMessage() + "\n"
                + "Member: " + (e.getUserEmail() == null ? "signed out" : e.getUserEmail()) + "\n\n"
                + "More from the same endpoint in the next 15 minutes will be logged on the admin dashboard but not emailed again.";
        for (String a : adminEmailsCsv.split(",")) {
            String to = a.trim();
            if (to.isEmpty()) continue;
            try { email.sendAnnouncement(to, "Server error on " + e.getPath(), body); }
            catch (Exception ex) { log.warn("Could not email the server-error alert to {}: {}", to, ex.toString()); }
        }
    }

    private static String cut(String s, int max) { return s == null ? null : s.length() > max ? s.substring(0, max) : s; }
}
