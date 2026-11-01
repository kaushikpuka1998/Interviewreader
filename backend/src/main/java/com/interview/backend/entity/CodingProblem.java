package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A LeetCode-style problem: a statement plus test cases the code runner checks. Kept apart from normal questions. */
@Entity
@Table(name = "coding_problems")
@Getter
@Setter
@NoArgsConstructor
public class CodingProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", length = 300, nullable = false)
    private String title;

    @Column(name = "difficulty", length = 20)
    private String difficulty;

    @Column(name = "statement", columnDefinition = "TEXT", nullable = false)
    private String statement;

    /** Code the member starts from, for example a class with an empty method. Shown to members. */
    @Column(name = "starter_code", columnDefinition = "TEXT")
    private String starterCode;

    /** C++ code with main() that reads the input, calls the member's function and prints the result. Never sent to the browser. */
    @Column(name = "driver", columnDefinition = "TEXT")
    private String driver;

    /** Per-language starter and driver, as JSON: {"cpp": {"starter": "...", "driver": "..."}, "python": {...}}. */
    @Column(name = "templates", columnDefinition = "TEXT")
    private String templates;

    /** JSON list of {"input": "...", "expected": "..."}. Never sent to the browser. */
    @Column(name = "test_cases", columnDefinition = "TEXT", nullable = false)
    private String testCases;

    /** Comma separated topics, e.g. "Array,Hash Table". A problem can have several. */
    @Column(name = "topics", length = 300)
    private String topics;

    /** Comma separated companies that ask this problem, e.g. "Google,Amazon". Empty when none is known. */
    @Column(name = "companies", columnDefinition = "TEXT")
    private String companies;

    /** Question analysis in Markdown (approach, complexity, walkthrough; images as links). Null = none, and the tab is hidden. */
    @Column(name = "analysis", columnDefinition = "TEXT")
    private String analysis;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();
}
