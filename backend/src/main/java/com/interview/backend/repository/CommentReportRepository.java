package com.interview.backend.repository;

import com.interview.backend.entity.CommentReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentReportRepository extends JpaRepository<CommentReport, Long> {
    boolean existsByCommentIdAndUserId(Long commentId, Long userId);
}
