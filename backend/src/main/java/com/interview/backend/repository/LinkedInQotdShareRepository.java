package com.interview.backend.repository;

import com.interview.backend.entity.LinkedInQotdShare;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LinkedInQotdShareRepository extends JpaRepository<LinkedInQotdShare, Long> {
    Optional<LinkedInQotdShare> findByUserIdAndPostedOn(Long userId, LocalDate postedOn);
    List<LinkedInQotdShare> findByUserIdAndPostedOnBetween(Long userId, LocalDate from, LocalDate to);
}
