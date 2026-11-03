package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One row per (user, discussion). Value is +1 for an upvote, -1 for a downvote; 0 means the vote was cleared. */
@Entity
@Table(name = "discussion_votes", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "discussion_id"}))
@Getter
@Setter
@NoArgsConstructor
public class DiscussionVote {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "discussion_id", nullable = false)
    private Long discussionId;

    @Column(nullable = false)
    private int value;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
