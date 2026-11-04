package com.interview.backend.repository;

import com.interview.backend.entity.EmailLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EmailLogRepository extends JpaRepository<EmailLog, Long> {

    List<EmailLog> findTop200ByOrderByCreatedAtDesc();

    /**
     * Every member with their last successful digest and nudge, and their most recent attempt.
     * Row: id, email, name, country, city, opt_out, last_digest, last_nudge, last_status.
     */
    @Query(value = "SELECT u.id, u.email, u.name, u.country, u.city, u.email_opt_out, " +
                   "(SELECT MAX(l.created_at) FROM email_logs l WHERE l.user_id = u.id AND l.type = 'DIGEST' AND l.status = 'SENT') AS last_digest, " +
                   "(SELECT MAX(l.created_at) FROM email_logs l WHERE l.user_id = u.id AND l.type = 'NUDGE' AND l.status = 'SENT') AS last_nudge, " +
                   "(SELECT l.status FROM email_logs l WHERE l.user_id = u.id ORDER BY l.created_at DESC LIMIT 1) AS last_status " +
                   "FROM app_users u ORDER BY u.created_at DESC", nativeQuery = true)
    List<Object[]> recipientStatus();

    /** Members whose mail with this subject failed since `since` and who have no successful one since then. */
    @Query(value = "SELECT COUNT(DISTINCT f.user_id) FROM email_logs f WHERE f.type = 'NUDGE' AND f.subject = :subject AND f.status = 'FAILED' AND f.created_at >= :since " +
                   "AND f.user_id NOT IN (SELECT s.user_id FROM email_logs s WHERE s.type = 'NUDGE' AND s.subject = :subject AND s.status = 'SENT' AND s.created_at >= :since AND s.user_id IS NOT NULL)", nativeQuery = true)
    long countFailedChallengeReminders(@org.springframework.data.repository.query.Param("subject") String subject, @org.springframework.data.repository.query.Param("since") java.time.Instant since);

    @Query(value = "SELECT COUNT(DISTINCT s.user_id) FROM email_logs s WHERE s.type = 'NUDGE' AND s.subject = :subject AND s.status = 'SENT' AND s.created_at >= :since", nativeQuery = true)
    long countSentChallengeReminders(@org.springframework.data.repository.query.Param("subject") String subject, @org.springframework.data.repository.query.Param("since") java.time.Instant since);
}
