package com.interview.backend.repository;

import com.interview.backend.entity.CodeSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CodeSubmissionRepository extends JpaRepository<CodeSubmission, Long> {
    List<CodeSubmission> findTop20ByUserEmailAndProblemIdOrderByCreatedAtDesc(String userEmail, Long problemId);
    Optional<CodeSubmission> findByIdAndUserEmail(Long id, String userEmail);
    List<CodeSubmission> findByUserEmailAndCreatedAtAfter(String userEmail, Instant after);
    List<CodeSubmission> findByUserEmailAndStatus(String userEmail, String status);
    List<CodeSubmission> findByUserEmail(String userEmail);
    boolean existsByUserEmail(String userEmail);
}
