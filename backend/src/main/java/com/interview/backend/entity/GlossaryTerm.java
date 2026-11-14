package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A hover definition shown on a word inside answers. Admin-managed; overrides the built-in list in the frontend. */
@Entity
@Table(name = "glossary_terms")
@Getter
@Setter
@NoArgsConstructor
public class GlossaryTerm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Lower-case word or phrase to match. */
    @Column(nullable = false, unique = true, length = 80)
    private String term;

    @Column(nullable = false, length = 800)
    private String definition;

    @Column(length = 400)
    private String example;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
