package com.interview.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Indexes Hibernate's ddl-auto can't express, so the admin's "contains" search and the public company filter stay fast on a
 * very large table: trigram (pg_trgm) indexes for ILIKE '%text%', and the author's lower-cased email for prefix lookups.
 * Best effort: if the database user can't create the extension, the app still runs and the search just scans.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DiscussionIndexes implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        try {
            jdbc.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_disc_title_trgm ON discussions USING gin (title gin_trgm_ops)");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_disc_company_trgm ON discussions USING gin (company gin_trgm_ops)");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_disc_status_created ON discussions (status, created_at DESC)");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_disc_user ON discussions (user_id)");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_users_email_pattern ON app_users (lower(email) text_pattern_ops)");
        } catch (Exception e) {
            log.warn("Discussion search indexes were not created (search still works, just slower on huge tables): {}", e.getMessage());
        }
    }
}
