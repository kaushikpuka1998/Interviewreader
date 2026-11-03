package com.interview.backend.repository;

import com.interview.backend.entity.CouponRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    boolean existsByUserIdAndCouponId(Long userId, Long couponId);

    void deleteByCouponId(Long couponId);
}
