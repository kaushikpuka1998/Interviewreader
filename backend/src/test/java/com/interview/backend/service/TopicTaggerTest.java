package com.interview.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TopicTaggerTest {

    private static List<String> topics(String title, String statement) {
        return List.of(TopicTagger.infer(title, statement).split(","));
    }

    @Test
    void graphAndHeapUseTheCanonicalNames() {
        assertTrue(topics("Shortest route", "Given a graph with vertices and edges, find the shortest path.").contains("Graph Theory"));
        assertTrue(topics("Top ones", "Use a priority queue to keep the k-th largest value.").contains("Heap (Priority Queue)"));
        assertFalse(topics("Top ones", "Use a priority queue.").contains("Heap"));
    }

    @Test
    void neverReturnsEmpty() {
        assertEquals("Math", TopicTagger.infer("zzz", "zzz"));
        assertEquals("Math", TopicTagger.infer(null, null));
    }

    @Test
    void normalizeTrimsAndDeduplicates() {
        assertEquals("Array,Tree", TopicTagger.normalize(" Array, tree ,array,Tree,, "));
        assertNull(TopicTagger.normalize(" , "));
        assertNull(TopicTagger.normalize(null));
    }
}
