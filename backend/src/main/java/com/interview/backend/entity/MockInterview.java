package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A mock interview between a candidate and a volunteer interviewer.
 * It starts WAITING (the candidate asked for one), becomes MATCHED when an interviewer takes it,
 * and ends DONE or CANCELLED.
 */
@Entity
@Table(name = "mock_interviews", indexes = {
        @Index(name = "idx_mock_status_type", columnList = "status,type"),
        @Index(name = "idx_mock_candidate", columnList = "candidate_id"),
        @Index(name = "idx_mock_interviewer", columnList = "interviewer_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MockInterview {

    public static final String WAITING = "WAITING", MATCHED = "MATCHED", DONE = "DONE", CANCELLED = "CANCELLED", NO_SHOW = "NO_SHOW";
    public static final String CODING = "CODING", SYSTEM_DESIGN = "SYSTEM_DESIGN", RESUME = "RESUME";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "candidate_id", nullable = false)
    private Long candidateId;

    @Column(name = "interviewer_id")
    private Long interviewerId;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 20)
    private String status = WAITING;

    /** The candidate's resume the interviewer may view (optional for coding and system design). */
    @Column(name = "resume_id")
    private Long resumeId;

    /** Video call link, created when the interview is matched. */
    @Column(length = 300)
    private String callUrl;

    /** Shared whiteboard link, created when the interview is matched. */
    @Column(length = 300)
    private String whiteboardUrl;

    /** JSON list of {title, body}: the questions the interviewer may ask. Only the interviewer sees them. */
    @Column(columnDefinition = "TEXT")
    private String questionsJson;

    /** When the candidate wants the interview to happen. */
    private Instant slotAt;

    /** The candidate said they would also like to interview others: a lead for new interviewers. */
    private Boolean wantsToInterview = false;

    /** Live session: null until the interviewer starts it, then the position (0-based) of the question being asked. */
    private Integer currentIndex;

    private Instant startedAt;

    /** When the current question was put up (for the per-question timer). */
    private Instant questionStartedAt;

    /** The shared code editor of the live room: both people can type, the last change wins. */
    @Column(columnDefinition = "TEXT")
    private String editorCode;

    @Column(length = 20)
    private String editorLang;

    private Integer editorRev;

    /** The interviewer's feedback for the candidate: 1 to 5 overall, and what went well and what to improve. */
    private Integer feedbackRating;

    @Column(columnDefinition = "TEXT")
    private String feedbackStrengths;

    @Column(columnDefinition = "TEXT")
    private String feedbackImprove;

    private Instant feedbackAt;

    /** Output of the last run in the shared editor, shown to both people. */
    @Column(columnDefinition = "TEXT")
    private String editorOutput;

    @Column(length = 12)
    private String editorBy;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant matchedAt;

    /** Who did not turn up when the interview ended as NO_SHOW: CANDIDATE or INTERVIEWER. */
    @Column(length = 12)
    private String noShowBy;

    /** Last time the candidate accessed the live room (for presence tracking). */
    private Instant candidateLastSeen;

    /** Last time the interviewer accessed the live room (for presence tracking). */
    private Instant interviewerLastSeen;

    /** Interviewer's notes for system design interviews (diagrams, architecture notes, etc). */
    @Column(columnDefinition = "TEXT")
    private String designNotes;

    /** Candidate's uploaded design diagram/image for system design interviews. */
    @Column(length = 500)
    private String designImageUrl;

    /** Who uploaded the design image. */
    @Column(length = 12)
    private String designImageBy;

    private Instant designImageUploadedAt;
}
