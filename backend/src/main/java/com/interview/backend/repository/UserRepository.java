package com.interview.backend.repository;

import com.interview.backend.entity.User;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findByRazorpaySubscriptionId(String razorpaySubscriptionId);
    Optional<User> findByPracticeSubscriptionId(String practiceSubscriptionId);
    Optional<User> findByInterviewSubscriptionId(String interviewSubscriptionId);
    boolean existsByUsername(String username);
    List<User> findByUsernameIsNull();

    @Query("SELECT u.username FROM User u WHERE u.username IS NOT NULL")
    List<String> findAllUsernames();
    Optional<User> findByResetToken(String resetToken);
    boolean existsByEmail(String email);

    /** New-signup counters and feed for the admin dashboard. */
    long countByCreatedAtAfter(Instant since);

    List<User> findByCreatedAtAfterOrderByCreatedAtDesc(Instant since, Pageable pageable);

    List<User> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Subscribed members who haven't yet received the digest ending at :coveredTo. */
    @Query(
            "SELECT u FROM User u WHERE (u.emailOptOut IS NULL OR u.emailOptOut = false) " +
            "AND (u.lastDigestAt IS NULL OR u.lastDigestAt < :coveredTo) ORDER BY u.id")
    List<User> findDigestRecipients(@org.springframework.data.repository.query.Param("coveredTo") java.time.LocalDateTime coveredTo);

    /** Members who haven't opted out of email. */
    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.emailOptOut IS NULL OR u.emailOptOut = false ORDER BY u.id")
    List<User> findSubscribed();

    /** Subscribed members without a country or city (the leaderboard nudge audience). */
    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE (u.emailOptOut IS NULL OR u.emailOptOut = false) " +
            "AND (u.country IS NULL OR u.city IS NULL) ORDER BY u.id")
    List<User> findSubscribedWithoutLocation();

    /** Members missing a country or city who haven't been nudged since :before. */
    @Query("SELECT u FROM User u WHERE (u.country IS NULL OR u.city IS NULL) " +
            "AND (u.emailOptOut IS NULL OR u.emailOptOut = false) " +
            "AND (u.locationNudgedAt IS NULL OR u.locationNudgedAt < :before) ORDER BY u.id")
    List<User> findNeedingLocationNudge(@org.springframework.data.repository.query.Param("before") java.time.Instant before);

    /** Claims this member's nudge. 1 only for the first caller, so one email per member per week. */
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.locationNudgedAt = :now WHERE u.id = :id " +
            "AND (u.locationNudgedAt IS NULL OR u.locationNudgedAt < :before)")
    int claimLocationNudge(@org.springframework.data.repository.query.Param("id") Long id,
                           @org.springframework.data.repository.query.Param("now") java.time.Instant now,
                           @org.springframework.data.repository.query.Param("before") java.time.Instant before);

    /**
     * Claims this member's copy of the digest ending at :at. Returns 1 only for the caller that
     * flipped the row, so a second instance, a retry, or a repeated run can't email them again.
     */
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.lastDigestAt = :at WHERE u.id = :id " +
            "AND (u.lastDigestAt IS NULL OR u.lastDigestAt < :at)")
    int claimDigest(@org.springframework.data.repository.query.Param("id") Long id,
                    @org.springframework.data.repository.query.Param("at") java.time.LocalDateTime at);

    /** Signups per campaign: [utm_source, utm_campaign, signups]. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT u.utmSource, u.utmCampaign, COUNT(u) FROM User u WHERE u.utmSource IS NOT NULL " +
            "GROUP BY u.utmSource, u.utmCampaign ORDER BY COUNT(u) DESC")
    List<Object[]> countSignupsByCampaign();

    /** Members per country, unknown last. Row: country (null = unknown), members. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT u.country, COUNT(u) FROM User u GROUP BY u.country ORDER BY COUNT(u) DESC")
    List<Object[]> countByCountry();

    // Admin Premium tab: members matching an email, name or username, and everyone on Premium right now.
    @Query("SELECT u FROM User u WHERE LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY u.createdAt DESC")
    List<User> searchMembers(@org.springframework.data.repository.query.Param("q") String q, Pageable pageable);

    List<User> findByPremiumUntilAfterOrderByPremiumUntilDesc(Instant now);
}
