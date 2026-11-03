package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A refresh token. Only its SHA-256 hash is stored, so a database leak gives nobody a usable token.
 * Every refresh replaces the token with a new one in the same family (one family = one login on one device).
 * replacedAt marks a token that was rotated; revokedAt marks a family that was ended (logout, password reset,
 * or a rotated token being used again, which means it was stolen).
 */
@Entity
@Table(name = "refresh_tokens",
        indexes = {@Index(name = "idx_refresh_family", columnList = "family_id"),
                   @Index(name = "idx_refresh_user", columnList = "user_id")})
@Getter
@Setter
@NoArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "replaced_at")
    private Instant replacedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;
}
