package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** "Was this answer helpful?": one vote per question and voter (signed-in member "u:<id>", or visitor "s:<session>"). */
@Entity
@Table(name = "answer_votes",
        uniqueConstraints = @UniqueConstraint(name = "uq_answer_vote", columnNames = {"question_id", "voter"}),
        indexes = @Index(name = "idx_answer_vote_q", columnList = "question_id"))
@Getter @Setter @NoArgsConstructor
public class AnswerVote {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;
    @Column(nullable = false, length = 80)
    private String voter;
    @Column(nullable = false)
    private boolean helpful;
    @Column(length = 300)
    private String note;   // optional "what was missing?" on a not-helpful vote
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
