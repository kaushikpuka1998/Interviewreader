package com.interview.backend.repository;

import com.interview.backend.entity.MockInterview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

import java.util.Collection;
import java.util.List;

public interface MockInterviewRepository extends JpaRepository<MockInterview, Long> {
    List<MockInterview> findByStatusAndTypeAndCandidateIdNot(String status, String type, Long candidateId);

    List<MockInterview> findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(Long candidateId, Long interviewerId);

    boolean existsByCandidateIdAndStatusIn(Long candidateId, Collection<String> statuses);

    /** Interviews a candidate has used from one allowance since a date. Cancelled ones and interviewer no-shows don't count. */
    @Query("select count(m) from MockInterview m where m.candidateId = :candidate and m.billedAs = :source and m.createdAt >= :since"
            + " and m.status <> 'CANCELLED' and (m.status <> 'NO_SHOW' or m.noShowBy is null or m.noShowBy <> 'INTERVIEWER')")
    long countUsed(@Param("candidate") Long candidateId, @Param("source") String source, @Param("since") Instant since);
}
