package com.interview.backend.repository;

import com.interview.backend.entity.GlossaryTerm;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GlossaryTermRepository extends JpaRepository<GlossaryTerm, Long> {
    Optional<GlossaryTerm> findByTerm(String term);
}
