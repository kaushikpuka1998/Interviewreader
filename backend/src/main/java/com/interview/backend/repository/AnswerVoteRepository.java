package com.interview.backend.repository;

import com.interview.backend.entity.AnswerVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AnswerVoteRepository extends JpaRepository<AnswerVote, Long> {
    Optional<AnswerVote> findByQuestionIdAndVoter(String questionId, String voter);

    @Query("SELECT COUNT(v) FROM AnswerVote v WHERE v.questionId = ?1 AND v.helpful = true")
    long countHelpful(String questionId);

    @Query("SELECT COUNT(v) FROM AnswerVote v WHERE v.questionId = ?1 AND v.helpful = false")
    long countNotHelpful(String questionId);

    /** Per question: id, helpful votes, not-helpful votes. */
    @Query("SELECT v.questionId, SUM(CASE WHEN v.helpful = true THEN 1 ELSE 0 END), SUM(CASE WHEN v.helpful = false THEN 1 ELSE 0 END) " +
           "FROM AnswerVote v GROUP BY v.questionId")
    List<Object[]> totals();

    List<AnswerVote> findTop200ByHelpfulFalseAndNoteIsNotNullOrderByCreatedAtDesc();
}
