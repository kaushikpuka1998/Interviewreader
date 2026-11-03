package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A reply on a discussion post. parentId makes it a reply to another comment (the page nests them a few levels deep). */
@Entity
@Table(name = "discussion_comments", indexes = @Index(name = "idx_dcomment_post", columnList = "discussion_id,created_at"))
@Getter
@Setter
@NoArgsConstructor
public class DiscussionComment {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "discussion_id", nullable = false)
    private Long discussionId;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private boolean anonymous;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    /** active | hidden. Hidden comments are kept for moderation and are only listed for admins. */
    @Column(nullable = false, length = 10)
    private String status = "active";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** When the author last edited the comment; null if never. */
    @Column(name = "edited_at")
    private Instant editedAt;
}
