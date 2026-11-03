package com.interview.backend.repository;

import com.interview.backend.entity.DiscussionVote;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface DiscussionVoteRepository extends JpaRepository<DiscussionVote, Long> {

    Optional<DiscussionVote> findByUserIdAndDiscussionId(Long userId, Long discussionId);

    @Transactional
    @Modifying
    void deleteByDiscussionId(Long discussionId);
}
