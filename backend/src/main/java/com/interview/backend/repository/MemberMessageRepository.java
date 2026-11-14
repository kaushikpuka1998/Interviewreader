package com.interview.backend.repository;

import com.interview.backend.entity.MemberMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberMessageRepository extends JpaRepository<MemberMessage, Long> {
    List<MemberMessage> findByUserIdAndClosedAtIsNullOrderByCreatedAtDesc(Long userId);
    List<MemberMessage> findTop200ByOrderByCreatedAtDesc();
}
