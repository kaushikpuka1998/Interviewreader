package com.interview.backend.repository;

import com.interview.backend.entity.CodingProblem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CodingProblemRepository extends JpaRepository<CodingProblem, Long> {
    List<CodingProblem> findAllByOrderByIdAsc();

    List<CodingProblem> findByTopicsIsNull();

    List<CodingProblem> findTop15ByTitleContainingIgnoreCaseOrderByIdAsc(String title);

    List<CodingProblem> findByCompaniesIsNullOrCompanies(String empty);

    /** Listing row: only these columns are read, so statements, test cases and templates stay in the database. */
    interface Summary {
        Long getId();
        String getTitle();
        String getDifficulty();
        String getTopics();
        String getCompanies();
        java.time.Instant getCreatedAt();
    }

    List<Summary> findSummariesByOrderByIdAsc();

    /** Ids of problems that have a question analysis, so the list can flag them without loading the text. */
    @org.springframework.data.jpa.repository.Query("select p.id from CodingProblem p where p.analysis is not null and length(trim(p.analysis)) > 0")
    List<Long> idsWithAnalysis();
}
