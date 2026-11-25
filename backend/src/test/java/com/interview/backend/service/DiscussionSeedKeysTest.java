package com.interview.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DiscussionSeedKeysTest {

    @Test
    void everyPostGetsItsOwnStableKeyWithoutAnIdInTheFile() throws Exception {
        List<Map<String, String>> items;
        try (InputStream in = getClass().getResourceAsStream("/discussion-seed.json")) {
            items = new ObjectMapper().readValue(in, new TypeReference<>() {});
        }
        var keys = DiscussionSeed.keys(items);
        assertEquals(items.size(), new HashSet<>(keys).size());   // no two posts share a key
        assertTrue(items.stream().noneMatch(i -> i.containsKey("importKey")));
        assertEquals(390, keys.size());   // one post per company
        assertTrue(keys.contains("comp-in-company-google"));
        assertTrue(keys.contains("comp-in-company-100ms"));
        assertTrue(keys.stream().allMatch(k -> k.length() <= 120));
    }
}
