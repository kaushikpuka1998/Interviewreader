package com.interview.backend.controller;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ScaleFactsTest {

    @Test
    void readsStatedNumbersAndDerivesTheRest() {
        // Twitter states MAU only: DAU is derived as half.
        Map<String, Object> twitter = DesignPracticeController.userScale("Users:    400M MAU; 500M tweets/day = ~5,800/sec");
        assertEquals(400_000_000L, twitter.get("mau"));
        assertEquals(200_000_000L, twitter.get("dau"));
        assertEquals(true, twitter.get("fromModelAnswer"));

        // Registered users + DAU; read:write ratio picked up.
        Map<String, Object> s = DesignPracticeController.userScale("Users:    100M registered, 10M DAU\nreads outnumber writes 100:1");
        assertEquals(10_000_000L, s.get("dau"));
        assertEquals(100_000_000L, s.get("users"));
        assertEquals("100:1", s.get("readWrite"));

        // "1% of DAU" and tiny example counts are not the scale; nothing stated -> defaults.
        Map<String, Object> none = DesignPracticeController.userScale("Requests: ~1% of DAU/day. A room has 10 users.");
        assertEquals(10_000_000L, none.get("dau"));
        assertEquals(false, none.get("fromModelAnswer"));
        assertNull(none.get("readWrite"));
    }
}
