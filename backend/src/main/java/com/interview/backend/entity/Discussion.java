package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A member's post: an interview experience, a compensation report, or a general discussion. Readable without
 * an account (first page), postable and votable only by signed-in members. An anonymous post hides the author's
 * name from the feed; the row still carries the userId so the admin can moderate and the owner can delete it.
 */
@Entity
@Table(name = "discussions", indexes = {
        @Index(name = "idx_disc_created", columnList = "created_at"),
        @Index(name = "idx_disc_category_created", columnList = "category,created_at"),
        @Index(name = "idx_disc_score", columnList = "score")
})
@Getter
@Setter
@NoArgsConstructor
public class Discussion {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** experience | compensation | general. */
    @Column(nullable = false, length = 20)
    private String category;

    @Column(nullable = false)
    private boolean anonymous;

    @Column(length = 120)
    private String company;

    @Column(length = 40)
    private String role;

    @Column(length = 40)
    private String level;

    @Column(name = "yoe")
    private Integer yoe;

    /** Total cost-to-company, as the member typed it (e.g. "₹45 LPA + ₹10L stock"). Free text to keep a self-reported figure legible. */
    @Column(length = 80)
    private String ctc;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private int upvotes = 0;

    @Column(nullable = false)
    private int downvotes = 0;

    /** upvotes - downvotes, denormalised so the list can sort without scanning votes. */
    @Column(nullable = false)
    private int score = 0;

    @Column(nullable = false)
    private int views = 0;

    /** Active comments, kept in step by DiscussionController so the list needs no join. */
    @Column(name = "comment_count", nullable = false, columnDefinition = "integer default 0")
    private int commentCount = 0;

    /** active | hidden. Hidden posts are kept for moderation and are only returned to admins. */
    @Column(nullable = false, length = 10)
    private String status = "active";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** When the author last edited the post; null if never. */
    @Column(name = "edited_at")
    private Instant editedAt;
}
