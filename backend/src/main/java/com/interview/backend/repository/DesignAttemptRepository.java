package com.interview.backend.repository;

import com.interview.backend.entity.DesignAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DesignAttemptRepository extends JpaRepository<DesignAttempt, Long> {
    long countByUserIdAndSource(Long userId, String source);

    long countByUserIdAndSourceAndCreatedAtGreaterThanEqual(Long userId, String source, Instant since);

    List<DesignAttempt> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    List<DesignAttempt> findByUserId(Long userId);

    Optional<DesignAttempt> findByIdAndUserId(Long id, Long userId);
}
