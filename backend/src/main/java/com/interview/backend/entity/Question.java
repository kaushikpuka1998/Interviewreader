package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "questions", indexes = {
    @Index(name = "idx_questions_tech", columnList = "tech"),
    @Index(name = "idx_questions_category", columnList = "category"),
    @Index(name = "idx_questions_difficulty", columnList = "difficulty"),
    @Index(name = "idx_questions_number", columnList = "number"),
    @Index(name = "idx_questions_sort_key", columnList = "sort_key"),
    @Index(name = "idx_questions_tech_number", columnList = "tech, number")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class Question implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "id", length = 100, nullable = false)
    private String id;

    @Column(name = "number", nullable = false)
    private Integer number;

    @Column(name = "display_number", nullable = false)
    private Integer displayNumber;

    @Column(name = "sort_key", nullable = false)
    private Integer sortKey;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    @Column(name = "question", columnDefinition = "TEXT", nullable = false)
    private String question;

    @Column(name = "answer", columnDefinition = "TEXT", nullable = false)
    private String answer;

    @Column(name = "difficulty", length = 50)
    private String difficulty;

    @Column(name = "category", length = 200)
    private String category;

    @Column(name = "tech", length = 50, nullable = false)
    private String tech;

    /** Scoring rubric for solo system design practice (JSON). Never sent to clients with the question. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "rubric", columnDefinition = "TEXT")
    private String rubric;

    /**
     * Voice interviewer's hand-written bank for this design (JSON: scope, stage questions, deep dives, pushbacks).
     * Lives only in the database, imported by an admin, so it isn't published with the open-source code.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "interview_bank", columnDefinition = "TEXT")
    private String interviewBank;


    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Not stored. True on the copy sent to a member who isn't allowed to read this answer (see AccessService): the answer is blank. */
    @jakarta.persistence.Transient
    @Builder.Default
    private boolean locked = false;

    /** A copy with the answer removed and {@code locked} set: enough for a list row or a "Premium" page, nothing of the content. */
    /** A copy for list rows: everything except the answer text, which the reader loads when the question is opened. */
    public Question withoutAnswer() {
        return Question.builder().id(id).number(number).displayNumber(displayNumber).sortKey(sortKey).title(title).question(question)
                .answer(null).difficulty(difficulty).category(category).tech(tech).createdAt(createdAt).updatedAt(updatedAt).locked(locked).build();
    }

    public Question lockedCopy() {
        return Question.builder().id(id).number(number).displayNumber(displayNumber).sortKey(sortKey).title(title).question(question)
                .answer("").difficulty(difficulty).category(category).tech(tech).createdAt(createdAt).updatedAt(updatedAt).locked(true).build();
    }
}