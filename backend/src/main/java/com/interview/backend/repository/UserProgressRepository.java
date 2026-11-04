package com.interview.backend.repository;

import com.interview.backend.entity.UserProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserProgressRepository extends JpaRepository<UserProgress, Long> {

    /** True once the member has opened (or read) at least one question. */
    boolean existsByUserId(Long userId);
    List<UserProgress> findByUserId(Long userId);
    Optional<UserProgress> findByUserIdAndQuestionId(Long userId, String questionId);

    /** Visited questions per tech, counted in the database: [tech, count]. */
    @org.springframework.data.jpa.repository.Query("SELECT q.tech, COUNT(p) FROM UserProgress p, com.interview.backend.entity.Question q " +
            "WHERE p.userId = :userId AND p.visited = true AND q.id = p.questionId GROUP BY q.tech")
    java.util.List<Object[]> visitedByTech(@org.springframework.data.repository.query.Param("userId") Long userId);

    /** Visited questions per difficulty, counted in the database: [difficulty, count]. */
    @org.springframework.data.jpa.repository.Query("SELECT q.difficulty, COUNT(p) FROM UserProgress p, com.interview.backend.entity.Question q " +
            "WHERE p.userId = :userId AND p.visited = true AND q.id = p.questionId AND q.difficulty IS NOT NULL GROUP BY q.difficulty")
    java.util.List<Object[]> visitedByDifficulty(@org.springframework.data.repository.query.Param("userId") Long userId);
}
