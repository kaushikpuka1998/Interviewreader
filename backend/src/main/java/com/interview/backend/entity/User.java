package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "app_users", indexes = @Index(name = "idx_users_email", columnList = "email", unique = true))
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    private String name;

    private String resetToken;

    private Instant resetTokenExpiry;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** Last explicit sign-in; lets analytics tell "logged in only" apart from actual use. */
    private Instant lastLoginAt;

    /** Nullable on purpose: existing rows get null (= subscribed) without a column default. */
    private Boolean emailOptOut;

    /** coveredTo of the last digest this member received; a resumed run skips them. */
    private java.time.LocalDateTime lastDigestAt;

    /** Last time we asked this member to add a location (weekly nudge, claimed before sending). */
    private Instant locationNudgedAt;

    /** Personal note in Markdown. Private: shown only on the member's own profile. */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** Public handle for /u/{username}. Unique; null only for rows not yet backfilled. */
    @Column(unique = true, length = 30)
    private String username;

    /** Campaign the member signed up from (first UTM they arrived with), for conversion tracking. */
    @Column(name = "utm_source", length = 100)
    private String utmSource;

    @Column(name = "utm_campaign", length = 100)
    private String utmCampaign;

    /** Where the member is from. Typed by the user, or else resolved from their IP (the IP itself is never stored). */
    private String country;
    private String city;

    /** "user" when they entered it — IP lookups never overwrite that — or "ip". */
    @Column(length = 8)
    private String locationSource;

    /** Age check at sign-up. Under 18 needs a parent or guardian's name, email and consent. */
    private java.time.LocalDate dateOfBirth;
    private String guardianName;
    private String guardianEmail;
    private Instant guardianConsentAt;

    /** Premium (paid roadmaps) is active while this is in the future. Set by Razorpay payment / webhook. */
    private Instant premiumUntil;
    /** The member's current Razorpay subscription (sub_...), if any. */
    @Column(length = 40)
    private String razorpaySubscriptionId;
    /** Razorpay subscription status as last reported: created, active, cancelled, halted, completed. */
    @Column(length = 20)
    private String subscriptionStatus;
}
