package com.interview.backend.service;

import com.interview.backend.entity.CodingProblem;
import com.interview.backend.repository.CodingProblemRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class ProblemTopicDeltaTest {

    private static CodingProblem problem(String title, String topics) {
        CodingProblem p = new CodingProblem();
        p.setTitle(title);
        p.setTopics(topics);
        return p;
    }

    @SuppressWarnings("unchecked")
    private static List<CodingProblem> run(List<CodingProblem> all) throws Exception {
        CodingProblemRepository repo = mock(CodingProblemRepository.class);
        when(repo.findAll()).thenReturn(all);
        new ProblemTopicDelta(repo).run();
        ArgumentCaptor<List<CodingProblem>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo, atMost(1)).saveAll(saved.capture());
        return saved.getAllValues().isEmpty() ? List.of() : saved.getValue();
    }

    @Test
    void appliesOnlyWhileTopicsStillEqualFrom() throws Exception {
        // "Count Inversions" is in problem-topics-delta.json with from = "Array,Sorting"
        CodingProblem untouched = problem("Count Inversions", "Array,Sorting");
        CodingProblem editedByAdmin = problem("Count Inversions", "Array,Sorting,Math");
        List<CodingProblem> saved = run(List.of(untouched, editedByAdmin));
        assertEquals(1, saved.size());
        assertTrue(untouched.getTopics().contains("Merge Sort"));
        assertEquals("Array,Sorting,Math", editedByAdmin.getTopics());
    }

    @Test
    void secondRunChangesNothing() throws Exception {
        CodingProblem p = problem("Count Inversions", "Array,Sorting");
        run(List.of(p));
        assertTrue(run(List.of(p)).isEmpty());
    }

    @Test
    void unknownTitlesAreIgnored() throws Exception {
        CodingProblem p = problem("No such problem", "Array");
        assertTrue(run(List.of(p)).isEmpty());
        assertEquals("Array", p.getTopics());
    }
}
