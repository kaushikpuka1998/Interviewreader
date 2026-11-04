package com.interview.backend.practice;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AnswerCoachTest {

    private static final String MODEL = """
            ## Idempotency
            A retry must not apply the same payment twice. Use an **idempotency key** stored with the result, and a **fencing token**
            so a stale leader cannot write after a newer one. Prefer **exactly-once semantics** only where the sink supports it;
            otherwise combine `at-least-once` delivery with a deduplicating consumer. Know the **trade-off** with latency.
            """;

    @Test
    void fullAnswerScoresHighAndShortOneLow() {
        String good = "To make payments safe to retry I store an idempotency key with the saved result, so a repeated request returns the same response. "
                + "A fencing token stops a stale leader from writing after a newer one has taken over, for example after a long pause. "
                + "I use at-least-once delivery with a deduplicating consumer, since exactly-once semantics only works where the sink supports it.";
        var r = AnswerCoach.coach(MODEL, good);
        assertTrue(r.score() >= 8, "score " + r.score());
        assertTrue(r.missed().size() <= 2);

        var thin = AnswerCoach.coach(MODEL, "Just retry it a few times.");
        assertTrue(thin.score() <= 2.0);
    }

    @Test
    void reportsTheMissingPoints() {
        String partial = "I would store an idempotency key with the result so that a retried payment request returns the same response, for example after a timeout, "
                + "and I would keep that key for a day so late retries are still safe, because clients do retry after network errors.";
        var r = AnswerCoach.coach(MODEL, partial);
        assertTrue(r.covered().stream().anyMatch(s -> s.toLowerCase().contains("idempotency")));
        assertTrue(r.missed().stream().anyMatch(s -> s.toLowerCase().contains("fencing")), r.missed().toString());
        assertTrue(r.feedback().stream().anyMatch(s -> s.contains("Mention ")));
    }

    @Test
    void proseOnlyModelAnswerUsesItsOwnTerms() {
        String model = "`HashMap` is non-synchronized, allows one null key and multiple null values, and is faster. `Hashtable` is thread-safe (synchronized), does not allow null keys/values, and is legacy.\n\n```java\nMap<String,Integer> m = new HashMap<>();\n```";
        var good = AnswerCoach.coach(model, "HashMap is not synchronized and allows one null key, it is faster. Hashtable is thread-safe because it is synchronized, but it is legacy and rejects null keys and values.");
        assertEquals("terms", good.basis());
        assertTrue(good.score() >= 6, "score " + good.score() + " missed " + good.missed());
        var off = AnswerCoach.coach(model, "I like cooking dinner for my family on weekends and trying new recipes with friends.");
        assertTrue(off.score() <= 2.5, "score " + off.score());
    }
}
