package com.interview.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.CodingProblemRepository.Summary;
import com.interview.backend.repository.QuestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LandingServiceTest {

    private static Summary problem(long id, String difficulty, String topics, String companies) {
        return new Summary() {
            public Long getId() { return id; }
            public String getTitle() { return "Problem " + id; }
            public String getDifficulty() { return difficulty; }
            public String getTopics() { return topics; }
            public String getCompanies() { return companies; }
            public Instant getCreatedAt() { return Instant.EPOCH; }
        };
    }

    private LandingService service;

    @BeforeEach
    void setUp() throws Exception {
        var repo = mock(CodingProblemRepository.class);
        var rows = new ArrayList<Summary>();
        for (int i = 0; i < 20; i++) rows.add(problem(i, i < 12 ? "Basic" : "Advanced", "Array,Heap (Priority Queue)", "Acme Corp"));   // 20 Acme array problems
        for (int i = 20; i < 23; i++) rows.add(problem(i, "Basic", "Array", "Tiny Co"));                                                   // too few for a page
        when(repo.findSummariesByOrderByIdAsc()).thenReturn(rows);
        service = new LandingService(mock(QuestionRepository.class), repo, new ObjectMapper());
    }

    @Test
    void makesPagesOnlyWhereEnoughProblemsExist() {
        assertTrue(service.has("/companies/acme-corp/coding-interview-questions"));
        assertTrue(service.has("/companies/acme-corp/array-problems"));
        assertTrue(service.has("/companies/acme-corp/basic-problems"));
        assertTrue(service.has("/dsa/array"));
        assertTrue(service.has("/dsa/array/advanced"));
        assertFalse(service.has("/companies/tiny-co/coding-interview-questions"));   // 3 problems
        assertTrue(service.has("/dsa/heap-priority-queue/advanced"));               // 8 advanced: exactly the minimum is enough
        assertFalse(service.has("/dsa/array/intermediate"));                         // none at all
        assertFalse(service.has("/dsa/no-such-topic"));
    }

    @Test
    void listsTheMatchingProblemsAndLinksRelatedPages() {
        var page = service.build("/companies/acme-corp/basic-problems");
        assertEquals(12, ((List<?>) page.get("problems")).size());   // only the basic ones
        assertTrue(page.get("h1").toString().contains("Acme Corp"));
        assertTrue(service.paths().contains("/companies/acme-corp/array-problems"));
        assertEquals(service.paths().size(), new java.util.HashSet<>(service.paths()).size());   // no duplicate paths
    }
}
