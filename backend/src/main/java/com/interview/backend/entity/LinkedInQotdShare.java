package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/** A member-confirmed LinkedIn post for that day's Question of the Day. */
@Entity
@Table(name = "linkedin_qotd_shares",
        uniqueConstraints = @UniqueConstraint(name = "uq_linkedin_share_user_day", columnNames = {"user_id", "posted_on"}),
        indexes = @Index(name = "idx_linkedin_share_user_day", columnList = "user_id,posted_on"))
@Getter
@Setter
@NoArgsConstructor
public class LinkedInQotdShare {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;

    @Column(name = "posted_on", nullable = false)
    private LocalDate postedOn;

    @Column(name = "confirmed_at", nullable = false, updatable = false)
    private Instant confirmedAt = Instant.now();
}
