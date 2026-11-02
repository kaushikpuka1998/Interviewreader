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

    @Test
    void followUpsComeFromQuestionHeadings() {
        String answer = "# 20. Follow-ups\n\n## 20.1 How do you prevent double booking?\nUse an atomic transition.\n"
                + "```text\n## Not a heading inside code?\n```\n## 20.2 Why use a temporary seat hold?\n### Summary\n## Q3: What happens when a hold expires?\n";
        assertEquals(java.util.List.of("How do you prevent double booking?", "Why use a temporary seat hold?", "What happens when a hold expires?"),
                DesignPracticeController.followUps(answer));
        assertTrue(DesignPracticeController.followUps(null).isEmpty());
        assertEquals("Why use a search engine for the API?", DesignPracticeController.sentenceCase("Why Use a Search Engine for the API?"));
        assertTrue(DesignPracticeController.followUps("## What is idempotency?\n## 3.1 What if the client retries after a timeout?").contains("What if the client retries after a timeout?"));
        assertEquals(1, DesignPracticeController.followUps("## What is idempotency?\n## 3.1 What if the client retries after a timeout?").size());
    }

    @Test
    void challengesKeepParenthesesTogether() {
        var c = DesignPracticeController.challenges("Timeline. **Challenges**: timeline generation (hybrid fan-out, push vs pull), celebrity problem, real-time trends.\n## 7. Deep dive: generating short codes");
        assertEquals(java.util.List.of("timeline generation (hybrid fan-out, push vs pull)", "celebrity problem", "real-time trends", "generating short codes"), c);
        assertTrue(DesignPracticeController.challenges(null).isEmpty());
    }
}
