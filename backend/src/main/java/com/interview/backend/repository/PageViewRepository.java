package com.interview.backend.repository;

import com.interview.backend.entity.PageView;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface PageViewRepository extends JpaRepository<PageView, Long> {

    long countByCreatedAtAfter(Instant since);

    @Query("SELECT COUNT(DISTINCT p.sessionId) FROM PageView p WHERE p.createdAt > :since")
    long countUniqueVisitorsSince(@Param("since") Instant since);

    @Query("SELECT COUNT(DISTINCT p.sessionId) FROM PageView p")
    long countUniqueVisitors();

    /** Traffic sources, most popular first. */
    @Query("SELECT p.referrerHost AS host, COUNT(p) AS views, COUNT(DISTINCT p.sessionId) AS visitors " +
           "FROM PageView p WHERE p.createdAt > :since " +
           "GROUP BY p.referrerHost ORDER BY COUNT(p) DESC")
    List<Object[]> topReferrers(@Param("since") Instant since, Pageable pageable);

    /** Visits per campaign: [utm_source, utm_campaign, views, visitors]. In-app links (utm_source=app) are excluded. */
    @Query("SELECT p.utmSource, p.utmCampaign, COUNT(p), COUNT(DISTINCT p.sessionId) FROM PageView p " +
           "WHERE p.createdAt > :since AND p.utmSource IS NOT NULL AND p.utmSource <> 'app' " +
           "GROUP BY p.utmSource, p.utmCampaign ORDER BY COUNT(p) DESC")
    List<Object[]> topCampaigns(@Param("since") Instant since, Pageable pageable);

    /** Resume builder entry points: [utm_content (placement), views, visitors, signed-in users]. */
    @Query("SELECT p.utmContent, COUNT(p), COUNT(DISTINCT p.sessionId), COUNT(DISTINCT p.userId) FROM PageView p " +
           "WHERE p.createdAt > :since AND p.utmMedium = 'resume_builder' " +
           "GROUP BY p.utmContent ORDER BY COUNT(p) DESC")
    List<Object[]> resumeBuilderPlacements(@Param("since") Instant since);

    /** Most-opened questions. */
    @Query("SELECT p.questionId AS qid, COUNT(p) AS views FROM PageView p " +
           "WHERE p.createdAt > :since AND p.questionId IS NOT NULL " +
           "GROUP BY p.questionId ORDER BY COUNT(p) DESC")
    List<Object[]> topQuestions(@Param("since") Instant since, Pageable pageable);

    @Query("SELECT p.device AS device, COUNT(p) AS views FROM PageView p " +
           "WHERE p.createdAt > :since GROUP BY p.device ORDER BY COUNT(p) DESC")
    List<Object[]> deviceBreakdown(@Param("since") Instant since);

    /**
     * Views per day. Native so the date truncation works in Postgres; the JPQL
     * function() form differs across dialects.
     */
    @Query(value = "SELECT CAST(created_at AS DATE) AS d, COUNT(*) AS views, " +
                   "COUNT(DISTINCT session_id) AS visitors " +
                   "FROM page_views WHERE created_at > :since " +
                   "GROUP BY CAST(created_at AS DATE) ORDER BY d", nativeQuery = true)
    List<Object[]> dailySeries(@Param("since") Instant since);

    // ----- audience breakdown -----

    /** Distinct signed-in people who viewed something in the window. */
    @Query("SELECT COUNT(DISTINCT p.userId) FROM PageView p " +
           "WHERE p.createdAt > :since AND p.userId IS NOT NULL")
    long countIdentifiedUsersSince(@Param("since") Instant since);

    /** Sessions in the window that were never seen before it — i.e. first-time visitors. */
    @Query(value = "SELECT COUNT(*) FROM (" +
                   "  SELECT session_id FROM page_views" +
                   "  WHERE session_id IS NOT NULL" +
                   "  GROUP BY session_id" +
                   "  HAVING MIN(created_at) > :since" +
                   ") AS first_seen", nativeQuery = true)
    long countNewVisitorsSince(@Param("since") Instant since);

    /** Sessions in the window that produced more than one view. */
    @Query(value = "SELECT COUNT(*) FROM (" +
                   "  SELECT session_id FROM page_views" +
                   "  WHERE created_at > :since AND session_id IS NOT NULL" +
                   "  GROUP BY session_id" +
                   "  HAVING COUNT(*) > 1" +
                   ") AS engaged", nativeQuery = true)
    long countEngagedVisitorsSince(@Param("since") Instant since);

    /** Views split by whether the visitor was signed in. */
    @Query("SELECT COUNT(p) FROM PageView p WHERE p.createdAt > :since AND p.userId IS NOT NULL")
    long countSignedInViewsSince(@Param("since") Instant since);

    // Admin feedback: the pages a member opened most recently.
    List<PageView> findTop15ByUserIdOrderByCreatedAtDesc(Long userId);
}
