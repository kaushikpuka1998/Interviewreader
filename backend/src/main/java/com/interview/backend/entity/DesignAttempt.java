package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One scored solo system design practice answer. */
@Entity
@Table(name = "design_attempts", indexes = {
        @Index(name = "idx_design_attempts_user", columnList = "user_id, created_at"),
})
@Getter
@Setter
@NoArgsConstructor
public class DesignAttempt {
    public static final String FREE = "free";
    public static final String PLAN = "plan";
    public static final String ADMIN = "admin";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String answer;

    /** voice | text | interview */
    @Column(length = 10)
    private String mode;

    /** Interview mode: the interviewer style the candidate chose (soft, moderate, hard); sets the hiring bar. */
    @Column(length = 10)
    private String difficulty;

    private Integer durationSec;

    /** Out of 10, one decimal. */
    private Double score;

    /** Per-stage result, covered/missed concepts and feedback, as JSON. */
    @Column(columnDefinition = "TEXT")
    private String breakdown;

    /** Which allowance paid for it: free (3 per member), plan (monthly), admin (unlimited). */
    @Column(length = 10, nullable = false)
    private String source;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
