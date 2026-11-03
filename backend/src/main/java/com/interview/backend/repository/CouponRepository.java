package com.interview.backend.repository;

import com.interview.backend.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCodeIgnoreCase(String code);

    List<Coupon> findAllByOrderByCreatedAtDesc();

    /** Counts a use atomically, and only while there is still room under the cap. Returns 1 when counted. */
    @Modifying
    @Transactional
    @Query("UPDATE Coupon c SET c.redemptions = c.redemptions + 1 WHERE c.id = :id AND (c.maxRedemptions IS NULL OR c.redemptions < c.maxRedemptions)")
    int countUse(@Param("id") Long id);
}
