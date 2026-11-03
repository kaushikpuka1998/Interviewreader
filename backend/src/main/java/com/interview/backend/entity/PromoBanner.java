package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** The one site-wide banner an admin can switch on (a single row, id 1): a message, an optional coupon code and a button. */
@Entity
@Table(name = "promo_banner")
@Getter
@Setter
@NoArgsConstructor
public class PromoBanner {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(length = 200)
    private String message;

    /** Optional: a coupon code to show with a copy button. It only shows while that coupon is valid. */
    @Column(length = 24)
    private String couponCode;

    @Column(length = 40)
    private String ctaLabel;

    /** A path on this site ("/roadmaps") or an http(s) address. */
    @Column(length = 300)
    private String ctaUrl;

    /** all | signed-out | free (signed-in members without Premium). */
    @Column(nullable = false, length = 12)
    private String audience = "all";

    /** amber | emerald | violet. */
    @Column(nullable = false, length = 10)
    private String tone = "amber";

    @Column(nullable = false)
    private boolean dismissible = true;

    private Instant startsAt;
    private Instant endsAt;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
