package com.interview.backend.repository;

import com.interview.backend.entity.Discussion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

// Filters use '' for "any" (not null): Postgres can't infer the type of a null bound parameter in "? IS NULL".
public interface DiscussionRepository extends JpaRepository<Discussion, Long> {

    @Query("SELECT d FROM Discussion d WHERE d.status = 'active' " +
           "AND (:category = '' OR d.category = :category) " +
           "AND (:company = '' OR LOWER(d.company) LIKE LOWER(CONCAT('%', :company, '%'))) " +
           "ORDER BY d.createdAt DESC")
    Page<Discussion> newest(@Param("category") String category, @Param("company") String company, Pageable pageable);

    @Query("SELECT d FROM Discussion d WHERE d.status = 'active' " +
           "AND (:category = '' OR d.category = :category) " +
           "AND (:company = '' OR LOWER(d.company) LIKE LOWER(CONCAT('%', :company, '%'))) " +
           "ORDER BY d.score DESC, d.createdAt DESC")
    Page<Discussion> top(@Param("category") String category, @Param("company") String company, Pageable pageable);

    /**
     * Admin search over every post (hidden included): by title or company (contains), the author's email (starts with, so it
     * uses the email index), or the post id. Filters by status and category; sorted newest, highest score or most comments.
     * {@code q} arrives already escaped for LIKE. The title/company contains-search is served by the trigram indexes that
     * DiscussionIndexes creates; without them it falls back to a scan, which only matters past a few hundred thousand rows.
     */
    @Query(value = "SELECT d.* FROM discussions d LEFT JOIN app_users u ON u.id = d.user_id " +
            "WHERE (:status = '' OR d.status = :status) AND (:category = '' OR d.category = :category) " +
            "AND (:q = '' OR d.title ILIKE '%' || :q || '%' OR d.company ILIKE '%' || :q || '%' OR lower(u.email) LIKE lower(:q) || '%' OR CAST(d.id AS TEXT) = :q) " +
            "ORDER BY CASE WHEN :sort = 'score' THEN d.score END DESC NULLS LAST, CASE WHEN :sort = 'comments' THEN d.comment_count END DESC NULLS LAST, d.created_at DESC",
            countQuery = "SELECT COUNT(*) FROM discussions d LEFT JOIN app_users u ON u.id = d.user_id " +
            "WHERE (:status = '' OR d.status = :status) AND (:category = '' OR d.category = :category) " +
            "AND (:q = '' OR d.title ILIKE '%' || :q || '%' OR d.company ILIKE '%' || :q || '%' OR lower(u.email) LIKE lower(:q) || '%' OR CAST(d.id AS TEXT) = :q)",
            nativeQuery = true)
    Page<Discussion> adminSearch(@Param("status") String status, @Param("category") String category, @Param("q") String q,
                                 @Param("sort") String sort, Pageable pageable);

    /** Hide every live post by one member (a spammer): returns how many were hidden. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("UPDATE Discussion d SET d.status = 'hidden' WHERE d.userId = :userId AND d.status = 'active'")
    int hideAllByUser(@Param("userId") Long userId);

    /** The sidebar's "Trending now": top-scoring posts in the last 7 days. */
    @Query("SELECT d FROM Discussion d WHERE d.status = 'active' AND d.createdAt > :since ORDER BY d.score DESC, d.createdAt DESC")
    List<Discussion> trending(@Param("since") Instant since, Pageable pageable);
}
