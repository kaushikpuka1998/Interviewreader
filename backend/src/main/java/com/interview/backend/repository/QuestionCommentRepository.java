package com.interview.backend.repository;

import com.interview.backend.entity.QuestionComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface QuestionCommentRepository extends JpaRepository<QuestionComment, Long> {
    List<QuestionComment> findByQuestionIdAndStatusOrderByCreatedAtAsc(String questionId, String status);
    long countByQuestionIdAndStatus(String questionId, String status);
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);
    List<QuestionComment> findByReportsGreaterThanOrderByCreatedAtDesc(int reports, Pageable page);
    List<QuestionComment> findAllByOrderByCreatedAtDesc(Pageable page);
}
