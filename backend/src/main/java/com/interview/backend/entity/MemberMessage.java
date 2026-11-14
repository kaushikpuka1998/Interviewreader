package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A message an admin sends to one member, shown as a floating card on every login until the admin closes it. */
@Entity
@Table(name = "member_messages", indexes = @Index(name = "idx_member_messages_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class MemberMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(length = 320)
    private String email;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 1000)
    private String body;

    /** A personal coupon created with the message, if any. */
    @Column(name = "coupon_code", length = 24)
    private String couponCode;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** Set when an admin closes it; null = still showing. */
    private Instant closedAt;
}
