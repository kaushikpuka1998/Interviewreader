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

    // ---- Optional details the member chooses to show on their public profile (/u/<username>). All nullable; see PublicDetails. ----
    /** The coupon code on the Premium order the member is about to pay for (counted once the payment is confirmed). */
    @Column(length = 24)
    private String premiumPendingCoupon;

    @Column(length = 120)
    private String headline;        // e.g. "Software Engineer at Acme"
    @Column(length = 120)
    private String college;
    @Column(length = 39)
    private String githubUser;      // the handle only; the page builds the link
    @Column(length = 100)
    private String linkedinHandle;  // the /in/<handle> part only
    @Column(length = 200)
    private String websiteUrl;      // http(s) only
    @Column(length = 280)
    private String bio;
    @Column(length = 220)
    private String skills;          // comma-separated tags, at most 8

    /** When the one-time "add your college, GitHub and LinkedIn" invitation was shown (and answered or dismissed); null = not yet. */
    private Instant profilePromptSeenAt;

    /** What the member is preparing for: drives the countdown, the plan and the 30-day pass. */
    @Column(length = 60)
    private String targetCompany;
    @Column(length = 60)
    private String targetRole;
    private java.time.LocalDate interviewDate;

    /** The member's uploaded profile picture (a URL served by this app). Wins over the Google one. */
    @Column(length = 512)
    private String avatarUrl;

    /** The picture on the member's Google account, refreshed on each Google sign-in. */
    @Column(length = 512)
    private String googlePicture;

    /** What to show: the uploaded picture if there is one, else the Google picture, else null (initials are drawn instead). */
    public String effectivePicture() {
        return avatarUrl != null && !avatarUrl.isBlank() ? avatarUrl : (googlePicture != null && !googlePicture.isBlank() ? googlePicture : null);
    }

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
    /** Referral: this member's share code, who referred them, and when they used their one 3-day trial. */
    @Column(length = 12, unique = true)
    private String referralCode;
    private Long referredBy;
    private Instant trialUsedAt;
    /** The day (India time) the "your streak ends tonight" email was last sent. */
    private java.time.LocalDate streakNudgedOn;

    /** The day (India time) the "today's challenge is waiting" reminder was last sent. */
    private java.time.LocalDate dailyRemindedOn;
    /** The member's current Razorpay subscription (sub_...), if any. */
    @Column(length = 40)
    private String razorpaySubscriptionId;
    /** Razorpay subscription status as last reported: created, active, cancelled, halted, completed. */
    @Column(length = 20)
    private String subscriptionStatus;

    /** Premium bought as a one-time pass: monthly, yearly or lifetime (null for the old recurring subscription). */
    @Column(length = 10)
    private String premiumPlan;
    /** A Premium checkout in progress (Razorpay order_...): granted once its payment is verified. */
    @Column(length = 10)
    private String premiumPendingPlan;
    @Column(length = 40)
    private String premiumPendingOrderId;
    /** Admin who gave this member Premium (null when it was paid for). Cleared when the member pays. */
    @Column(length = 150)
    private String premiumGrantedBy;

    /** Daily login streak: consecutive days (India time) with a sign-in, the best ever, and the last day counted. */
    private Integer streakCount;
    private Integer streakBest;
    private java.time.LocalDate streakLastDate;
    /** Premium members' streak survives one missed day every 30 days; this is the day it last did. */
    private java.time.LocalDate streakFreezeUsedOn;

    /** Peer (real person) mock interview plan (i5, i10): monthly interview allowance, billed separately from Premium. */
    @Column(length = 8)
    private String interviewPlan;
    @Column(length = 40)
    private String interviewSubscriptionId;
    @Column(length = 20)
    private String interviewStatus;
    private Instant interviewPeriodStart;
    private Instant interviewPeriodEnd;
    @Column(length = 8)
    private String interviewPendingPlan;
    @Column(length = 40)
    private String interviewPendingSubscriptionId;

    /** System design practice plan (p12, p18, p24): monthly attempt allowance, billed separately from Premium. */
    @Column(length = 8)
    private String practicePlan;
    @Column(length = 40)
    private String practiceSubscriptionId;
    @Column(length = 20)
    private String practiceStatus;
    /** The current billing period; plan attempts are counted from its start, and the allowance ends with it. */
    private Instant practicePeriodStart;
    private Instant practicePeriodEnd;
    /** A practice checkout in progress: becomes the plan above once its payment is verified. */
    @Column(length = 8)
    private String practicePendingPlan;
    @Column(length = 40)
    private String practicePendingSubscriptionId;
}
