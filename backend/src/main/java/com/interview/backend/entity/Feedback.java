package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A visitor's feedback about the portal. Anyone can send it; admins read it at /admin/feedback. */
@Entity
@Table(name = "feedback")
@Getter
@Setter
@NoArgsConstructor
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 1 to 5 stars, or null when the visitor gave none. */
    private Integer rating;

    @Column(nullable = false, length = 2000)
    private String message;

    /** The sender's account email when they were signed in, otherwise the email they typed (required). */
    @Column(length = 200)
    private String email;

    /** True when the email comes from the signed-in account rather than being typed. */
    private Boolean fromAccount = false;

    /** Screenshots the visitor attached, one URL per line (at most three). */
    @Column(columnDefinition = "TEXT")
    private String imageUrls;

    /** The page the visitor was on when they sent it. */
    @Column(length = 300)
    private String page;

    /** Answers to the option questions on the feedback page (JSON: question key -> chosen options). */
    @Column(columnDefinition = "TEXT")
    private String answers;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
