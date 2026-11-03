package com.interview.backend.repository;

import com.interview.backend.entity.PointEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface PointEventRepository extends JpaRepository<PointEvent, Long> {

    boolean existsByUserIdAndKindAndRef(Long userId, String kind, String ref);

    @Query("SELECT COALESCE(SUM(p.points), 0) FROM PointEvent p WHERE p.userId = :userId AND p.createdAt > :since")
    long pointsSince(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("SELECT COALESCE(SUM(p.points), 0) FROM PointEvent p WHERE p.userId = :userId")
    long totalPoints(@Param("userId") Long userId);

    /** Points per kind in the window for one member: rows of [kind, count, points]. */
    @Query("SELECT p.kind, COUNT(p), SUM(p.points) FROM PointEvent p WHERE p.userId = :userId AND p.createdAt > :since GROUP BY p.kind")
    List<Object[]> breakdownSince(@Param("userId") Long userId, @Param("since") Instant since);

    /** Leaderboard: top members by points in the window, rows of [user_id, points]. */
    @Query(value = "SELECT user_id, SUM(points) AS pts FROM point_events WHERE created_at > :since " +
                   "GROUP BY user_id ORDER BY pts DESC LIMIT :limit", nativeQuery = true)
    List<Object[]> topSince(@Param("since") Instant since, @Param("limit") int limit);

    // One-time backfill so the leaderboard doesn't reset when points replace read-based XP. ON CONFLICT keeps it idempotent.

    /** Each member's first qualifying read of each question, worth :points, dated when it happened. */
    @Transactional
    @Modifying
    @Query(value = "INSERT INTO point_events (user_id, kind, ref, points, created_at) " +
                   "SELECT user_id, 'read', question_id, :points, MIN(created_at) FROM user_events " +
                   "WHERE type = 'read' AND user_id IS NOT NULL AND question_id IS NOT NULL AND (seconds >= 30 OR scroll_pct >= 50) " +
                   "GROUP BY user_id, question_id ON CONFLICT DO NOTHING", nativeQuery = true)
    int backfillReads(@Param("points") int points);

    /** Each member's first accepted solve of each problem. */
    @Transactional
    @Modifying
    @Query(value = "INSERT INTO point_events (user_id, kind, ref, points, created_at) " +
                   "SELECT u.id, 'solve', CAST(s.problem_id AS VARCHAR), :points, MIN(s.created_at) FROM code_submissions s " +
                   "JOIN app_users u ON lower(u.email) = lower(s.user_email) WHERE s.status = 'Accepted' " +
                   "GROUP BY u.id, s.problem_id ON CONFLICT DO NOTHING", nativeQuery = true)
    int backfillSolves(@Param("points") int points);
}
