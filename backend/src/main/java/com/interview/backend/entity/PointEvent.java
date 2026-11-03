package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One award of points: a daily login, the first read of a question, the first accepted solve of a problem, or a
 * streak milestone. The unique (user, kind, ref) key makes every award happen at most once: ref is the date for a
 * login, the question id for a read, the problem id for a solve, "<days>@<date>" for a milestone.
 */
@Entity
@Table(name = "point_events",
        uniqueConstraints = @UniqueConstraint(name = "uq_point_event", columnNames = {"user_id", "kind", "ref"}),
        indexes = @Index(name = "idx_point_events_time", columnList = "created_at,user_id"))
@Getter
@Setter
@NoArgsConstructor
public class PointEvent {

    public static final String LOGIN = "login", READ = "read", SOLVE = "solve", STREAK = "streak";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 12)
    private String kind;

    @Column(nullable = false, length = 120)
    private String ref;

    @Column(nullable = false)
    private int points;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
