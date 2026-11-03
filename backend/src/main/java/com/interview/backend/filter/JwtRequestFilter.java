package com.interview.backend.filter;

import com.interview.backend.util.JwtUtil;
import com.interview.backend.util.CookieUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class JwtRequestFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final CookieUtil cookieUtil;
    private final Set<String> adminEmails;

    public JwtRequestFilter(JwtUtil jwtUtil, CookieUtil cookieUtil, @Value("${app.admin.emails:}") String adminEmailsCsv) {
        this.jwtUtil = jwtUtil;
        this.cookieUtil = cookieUtil;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // Cookie only: no Authorization header, so a token can't be lifted from page storage and replayed.
        String token = cookieUtil.getTokenFromCookie(request);

        if (token != null) {
            try {
                String email = jwtUtil.extractEmail(token);
                if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    List<SimpleGrantedAuthority> authorities = adminEmails.contains(email.toLowerCase())
                            ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                            : List.of();
                    UserDetails details = new org.springframework.security.core.userdetails.User(
                            email, "", authorities);
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            details, null, details.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                // Invalid token
            }
        }
        chain.doFilter(request, response);
    }
}
