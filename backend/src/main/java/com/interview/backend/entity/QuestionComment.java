package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A member's comment under a question. Hidden comments (reported 3 times, or hidden by an admin) are not shown. */
@Entity
@Table(name = "question_comments", indexes = @Index(name = "idx_comment_q", columnList = "question_id,created_at"))
@Getter @Setter @NoArgsConstructor
public class QuestionComment {
    public static final String VISIBLE = "VISIBLE", HIDDEN = "HIDDEN";
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 2000)
    private String body;
    @Column(nullable = false, length = 10)
    private String status = VISIBLE;
    @Column(nullable = false)
    private int reports = 0;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
