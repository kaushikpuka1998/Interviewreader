package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One row per attempt to buy a Premium pass: who, which pass, how much, and how it ended (STARTED, PAID or FAILED). */
@Entity
@Table(name = "payment_attempts", indexes = {
        @Index(name = "idx_payment_attempts_created", columnList = "created_at"),
        @Index(name = "idx_payment_attempts_order", columnList = "order_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PaymentAttempt {
    public static final String STARTED = "STARTED", PAID = "PAID", FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id")
    private Long userId;
    @Column(length = 320)
    private String email;
    @Column(length = 20)
    private String plan;
    /** Rupees. */
    private Integer amount;
    @Column(name = "order_id", length = 60)
    private String orderId;
    @Column(length = 10, nullable = false)
    private String status;
    @Column(length = 300)
    private String error;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at")
    private Instant updatedAt;
}
