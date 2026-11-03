package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A discount code for the Premium passes, created by an admin. Applied at checkout; counted when the payment goes through. */
@Entity
@Table(name = "coupons", uniqueConstraints = @UniqueConstraint(columnNames = "code"))
@Getter
@Setter
@NoArgsConstructor
public class Coupon {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Upper-case letters, digits, _ and -, e.g. DIWALI20. */
    @Column(nullable = false, length = 24)
    private String code;

    /** percent (value = 1-90) or flat (value = rupees off). */
    @Column(nullable = false, length = 8)
    private String kind;

    @Column(nullable = false)
    private int value;

    /** Comma-separated plan keys (monthly, yearly, lifetime) the code works on; empty = all passes. */
    @Column(length = 40)
    private String appliesTo;

    @Column(nullable = false)
    private boolean active = true;

    private Instant startsAt;
    private Instant endsAt;

    /** Total uses allowed across all members; null = unlimited. */
    private Integer maxRedemptions;

    @Column(nullable = false)
    private int redemptions = 0;

    /** Admin's own note ("Diwali campaign"). Not shown to members. */
    @Column(length = 200)
    private String note;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
