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

    /** Per problem and result for one member: [problemId, status, count]. Feeds the skill gap analysis without loading code. */
    @org.springframework.data.jpa.repository.Query("select s.problemId, s.status, count(s) from CodeSubmission s where lower(s.userEmail) = lower(:email) group by s.problemId, s.status")
    java.util.List<Object[]> problemOutcomes(@org.springframework.data.repository.query.Param("email") String email);
}
