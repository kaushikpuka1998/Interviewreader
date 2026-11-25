package com.interview.backend.repository;

import com.interview.backend.entity.CompanySalary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompanySalaryRepository extends JpaRepository<CompanySalary, Long> {
    List<CompanySalary> findAllByOrderByIdAsc();
}
