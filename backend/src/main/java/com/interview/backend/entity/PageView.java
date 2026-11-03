package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One row per tracked event (page view / question open).
 *
 * Deliberately stores no IP address: unique visitors are counted with a
 * client-generated session id, which keeps the table free of personal data.
 */
@Entity
@Table(name = "page_views", indexes = {
        @Index(name = "idx_pv_created", columnList = "created_at"),
        @Index(name = "idx_pv_question", columnList = "question_id"),
        @Index(name = "idx_pv_referrer", columnList = "referrer_host"),
        @Index(name = "idx_pv_session", columnList = "session_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PageView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 512)
    private String path;

    @Column(name = "question_id", length = 100)
    private String questionId;

    /** Full referrer URL, truncated. Empty for direct traffic. */
    @Column(length = 512)
    private String referrer;

    /** Host part of the referrer, or "direct" — this is what the report groups by. */
    @Column(name = "referrer_host", length = 200)
    private String referrerHost;

    /** Random id generated in the browser; identifies a visitor without an IP. */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    /** Set when the visitor was signed in, otherwise null. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "device", length = 20)
    private String device;   // mobile | tablet | desktop

    /** The visitor's active colour theme at this view: dark | light. Null for views recorded before this was tracked. */
    @Column(name = "theme", length = 10)
    private String theme;

    /** UTM tags from the landing URL (last-touch), e.g. utm_source=college_x. Null for untagged visits. */
    @Column(name = "utm_source", length = 100)
    private String utmSource;

    @Column(name = "utm_campaign", length = 100)
    private String utmCampaign;

    @Column(name = "utm_medium", length = 100)
    private String utmMedium;

    @Column(name = "utm_content", length = 100)
    private String utmContent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
