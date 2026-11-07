package com.interview.backend.repository;

import com.interview.backend.entity.ArchitectureSimulation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArchitectureSimulationRepository extends JpaRepository<ArchitectureSimulation, Long> {
    long countByUserId(Long userId);
}
