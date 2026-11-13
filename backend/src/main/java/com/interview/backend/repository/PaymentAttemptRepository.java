package com.interview.backend.repository;

import com.interview.backend.entity.PaymentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
    List<PaymentAttempt> findTop200ByCreatedAtAfterOrderByCreatedAtDesc(Instant since);

    @Transactional
    @Modifying
    @Query("update PaymentAttempt p set p.status = 'PAID', p.error = null, p.updatedAt = :now where p.orderId = :orderId and p.status <> 'PAID'")
    int markPaid(@Param("orderId") String orderId, @Param("now") Instant now);
}
