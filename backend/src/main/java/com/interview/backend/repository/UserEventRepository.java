package com.interview.backend.repository;

import com.interview.backend.entity.UserEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface UserEventRepository extends JpaRepository<UserEvent, Long> {

    /** [avg scroll %, total seconds, distinct sessions] over all reads in the window. */
    @Query("SELECT AVG(e.scrollPct), COALESCE(SUM(e.seconds), 0), COUNT(DISTINCT e.sessionId) " +
           "FROM UserEvent e WHERE e.type = 'read' AND e.createdAt > :since")
    List<Object[]> readTotals(@Param("since") Instant since);

    /** Per question: avg scroll %, total seconds, distinct sessions. */
    @Query("SELECT e.questionId, AVG(e.scrollPct), COALESCE(SUM(e.seconds), 0), COUNT(DISTINCT e.sessionId) " +
           "FROM UserEvent e WHERE e.type = 'read' AND e.createdAt > :since AND e.questionId IN :ids " +
           "GROUP BY e.questionId")
    List<Object[]> readStatsFor(@Param("since") Instant since, @Param("ids") Collection<String> ids);

    @Query("SELECT e.label, COUNT(e) FROM UserEvent e " +
           "WHERE e.type = 'click' AND e.createdAt > :since AND e.label IS NOT NULL " +
           "GROUP BY e.label ORDER BY COUNT(e) DESC")
    List<Object[]> topClicks(@Param("since") Instant since, Pageable pageable);

    /**
     * Every member seen in the window (signed in, viewed, or produced an event) with
     * what they actually did. Row: email, name, last_login_at, views, read_seconds,
     * max_scroll, clicks, last_active, country, city.
     */
    @Query(value = """
            SELECT u.email, u.name, u.last_login_at,
                   COALESCE(pv.views, 0), COALESCE(ev.read_seconds, 0), COALESCE(ev.max_scroll, 0),
                   COALESCE(ev.clicks, 0), GREATEST(pv.last_seen, ev.last_seen, u.last_login_at),
                   u.country, u.city, u.username
            FROM app_users u
            LEFT JOIN (SELECT user_id, COUNT(*) views, MAX(created_at) last_seen
                       FROM page_views WHERE created_at > :since AND user_id IS NOT NULL
                       GROUP BY user_id) pv ON pv.user_id = u.id
            LEFT JOIN (SELECT user_id,
                              SUM(CASE WHEN type = 'read' THEN seconds ELSE 0 END) read_seconds,
                              MAX(CASE WHEN type = 'read' THEN scroll_pct ELSE 0 END) max_scroll,
                              SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) clicks,
                              MAX(created_at) last_seen
                       FROM user_events WHERE created_at > :since AND user_id IS NOT NULL
                       GROUP BY user_id) ev ON ev.user_id = u.id
            WHERE u.last_login_at > :since OR pv.user_id IS NOT NULL OR ev.user_id IS NOT NULL
            ORDER BY 8 DESC NULLS LAST
            """, nativeQuery = true)
    List<Object[]> memberActivity(@Param("since") Instant since);

    /** Qualifying reads in the window for a user (the basis of weekly XP). */
    @Query("SELECT COUNT(e) FROM UserEvent e WHERE e.userId = :userId AND e.type = 'read' " +
           "AND e.createdAt > :since AND (e.seconds >= 30 OR e.scrollPct >= 50)")
    long weeklyReadCount(@Param("userId") Long userId, @Param("since") Instant since);

    /** Top members by qualifying reads in the window: row = [user_id, reads]. */
    @Query(value = "SELECT user_id, COUNT(*) AS reads FROM user_events " +
                   "WHERE type = 'read' AND created_at > :since AND user_id IS NOT NULL " +
                   "AND (seconds >= 30 OR scroll_pct >= 50) " +
                   "GROUP BY user_id ORDER BY reads DESC LIMIT :limit", nativeQuery = true)
    List<Object[]> weeklyReaders(@Param("since") Instant since, @Param("limit") int limit);
}
