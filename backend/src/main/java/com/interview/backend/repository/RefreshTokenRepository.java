package com.interview.backend.repository;

import com.interview.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Transactional
    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :now WHERE t.familyId = :family AND t.revokedAt IS NULL")
    int revokeFamily(@Param("family") String family, @Param("now") Instant now);

    @Transactional
    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :now WHERE t.userId = :userId AND t.revokedAt IS NULL")
    int revokeAllForUser(@Param("userId") Long userId, @Param("now") Instant now);

    @Transactional
    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
