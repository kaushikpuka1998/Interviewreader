package com.interview.backend.repository;

import com.interview.backend.entity.DiscussionComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface DiscussionCommentRepository extends JpaRepository<DiscussionComment, Long> {

    List<DiscussionComment> findByDiscussionIdAndStatusOrderByCreatedAtAsc(Long discussionId, String status);

    List<DiscussionComment> findByDiscussionIdOrderByCreatedAtAsc(Long discussionId);

    long countByDiscussionIdAndStatus(Long discussionId, String status);

    @Transactional
    @Modifying
    void deleteByDiscussionId(Long discussionId);
}
