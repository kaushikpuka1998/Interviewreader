package com.interview.backend.config;

import com.interview.backend.filter.JwtRequestFilter;
import com.interview.backend.filter.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtRequestFilter jwtRequestFilter;

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Value("${app.ratelimit.auth-max-requests:10}")
    private int authMaxRequests;

    @Value("${app.ratelimit.auth-window-seconds:60}")
    private long authWindowSeconds;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Security headers: deny framing (clickjacking), no MIME sniffing, tight referrer.
                .headers(h -> h
                        .frameOptions(f -> f.deny())
                        .contentTypeOptions(c -> {})
                        .referrerPolicy(r -> r.policy(
                                org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Company reports: any signed-in user may add/remove their own.
                        // MUST precede the admin-only /questions/** rules below, since
                        // the first matching rule wins.
                        .requestMatchers(HttpMethod.GET, "/questions/*/companies").authenticated()
                        .requestMatchers(HttpMethod.POST, "/questions/*/companies").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/questions/*/companies/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/companies").authenticated()
                        // Suggested edits: any signed-in user may propose one and see their
                        // own; the review queue is admin-only. Must precede /questions/**.
                        .requestMatchers(HttpMethod.POST, "/questions/*/suggestions").authenticated()
                        .requestMatchers("/suggestions/mine", "/suggestions/mine/seen").authenticated()
                        .requestMatchers("/suggestions/**").hasRole("ADMIN")
                        // Duplicate reports: any signed-in reader may flag one; the review
                        // queue (and deleting the question) is admin-only. Must precede /questions/**.
                        .requestMatchers(HttpMethod.POST, "/questions/*/duplicate-report").authenticated()
                        .requestMatchers("/duplicate-reports/**").hasRole("ADMIN")
                        // Publishing questions is admin-only
                        .requestMatchers(HttpMethod.POST, "/questions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/questions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/questions/**").hasRole("ADMIN")
                        // Any signed-in user may upload: suggested edits can include
                        // images. Type and 5 MB size are enforced in ImageService.
                        .requestMatchers(HttpMethod.POST, "/images/**").authenticated()
                        // Anyone may record a view or an engagement event (anonymous visitors are what we
                        // measure; the controller attributes to an account only when a token is present).
                        // Only admins may read the reports.
                        .requestMatchers(HttpMethod.POST, "/analytics/track", "/analytics/events").permitAll()
                        .requestMatchers("/analytics/**").hasRole("ADMIN")
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        // Resumes are private to their owner.
                        .requestMatchers("/resumes", "/resumes/**").authenticated()
                        .requestMatchers("/code/**").authenticated()
                        .requestMatchers("/interviews/admin/**").hasRole("ADMIN")
                        .requestMatchers("/interviews/**").authenticated()
                        // Billing: Razorpay calls the webhook (HMAC-verified in BillingService); the rest is per member.
                        .requestMatchers(HttpMethod.POST, "/billing/webhook").permitAll()
                        .requestMatchers("/billing/**").authenticated()
                        // Public: auth
                        .requestMatchers("/auth/**", "/health").permitAll()
                        // Reads are open so signed-out visitors can browse the free topics.
                        // QuestionController enforces per-topic access (401 signup_required).
                        // Companies and the rules above stay authenticated.
                        .requestMatchers(HttpMethod.GET, "/questions/**").permitAll()
                        // Progress + profile require a logged-in user
                        .requestMatchers("/progress/**", "/profile/**").authenticated()
                        .anyRequest().permitAll())
                // Rate limiter runs first (before auth) to blunt brute-force on /auth/**.
                .addFilterBefore(new RateLimitFilter(authMaxRequests, authWindowSeconds), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // Patterns, so "http://localhost:*" matches any dev port (the Vite port changes when 5173 is busy).
        cfg.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
