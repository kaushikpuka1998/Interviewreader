package com.interview.backend.practice;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DesignScorerTest {

    private static final Rubric RUBRIC = new Rubric("auto", RubricDrafter.standardStages());

    private static final String STRONG = """
            First I clarify the functional requirements: users can create short links and the service should support custom aliases.
            For non functional requirements we need low latency redirects and high availability, at a scale of 100 million daily active users.
            For the estimate, writes are about 1,000 requests per second and reads are 100k qps, so the system is read heavy.
            Storage is roughly 500 bytes per link, which is about 15 terabytes per year with a five year retention.
            The API is a POST endpoint to create a link and a GET request that redirects with a 301.
            The data model is one table with the short code as the primary key, stored in a nosql database like cassandra.
            Behind a load balancer, a stateless application service handles requests and we cache hot links in redis.
            Analytics events go to a kafka queue so a worker can process clicks asynchronously.
            To scale we shard by the short code using consistent hashing and add a read replica for each partition.
            We scale horizontally because the service is stateless, with autoscaling on traffic.
            For failure handling we use retries with backoff and a circuit breaker, and failover to replicas.
            We add monitoring with metrics and alerts, and writes are idempotent so retries are safe.
            The main trade off is consistency versus availability, and a counter based id is an alternative to hashing, at the cost of a coordination service.
            """;

    @Test
    void strongAnswerScoresHigh() {
        DesignScorer.Result r = DesignScorer.score(RUBRIC, STRONG);
        assertTrue(r.score() >= 8.5, "strong answer scored " + r.score());
        assertTrue(r.stages().stream().allMatch(s -> s.score() >= 0.8), "every stage should be covered: " + r.stages());
    }

    @Test
    void keywordDumpScoresLow() {
        String dump = ("qps redis kafka shard replica cache load balancer cdn api schema cassandra retry circuit breaker monitoring "
                + "idempotent trade off alternative latency availability storage bandwidth ").repeat(8);
        DesignScorer.Result r = DesignScorer.score(RUBRIC, dump);
        assertTrue(r.score() <= 1.5, "a keyword list must not score, got " + r.score());
    }

    @Test
    void shortAnswerIsCapped() {
        String shortAnswer = "We put the service behind a load balancer and cache the hot data in redis. "
                + "We shard the database by user id and use a kafka queue for the slow work.";
        DesignScorer.Result r = DesignScorer.score(RUBRIC, shortAnswer);
        assertTrue(r.words() < DesignScorer.VERY_SHORT_WORDS);
        assertTrue(r.score() <= 2.0, "very short answers are capped at 2, got " + r.score());
        assertTrue(r.feedback().stream().anyMatch(f -> f.contains("short")));
    }

    @Test
    void skippedStageIsReportedAsMissed() {
        String noReliability = STRONG.lines()
                .filter(l -> !l.contains("failure handling") && !l.contains("monitoring"))
                .reduce("", (a, b) -> a + b + "\n");
        DesignScorer.Result r = DesignScorer.score(RUBRIC, noReliability);
        DesignScorer.StageResult reliability = r.stages().stream().filter(s -> s.key().equals("reliability")).findFirst().orElseThrow();
        assertTrue(reliability.score() < 0.5, "reliability should be weak: " + reliability);
        assertTrue(reliability.missed().contains("Failure handling"));
        assertTrue(r.feedback().stream().anyMatch(f -> f.startsWith("Reliability & failure needs work")), r.feedback().toString());
        assertTrue(r.score() < DesignScorer.score(RUBRIC, STRONG).score());
    }

    @Test
    void plainPluralsMatchTheirSingular() {
        String s = "We will add read replicas so that the caches can serve most of the traffic from memory.";
        Rubric rubric = new Rubric("manual", java.util.List.of(new Rubric.Stage("x", "X", 1,
                java.util.List.of(new Rubric.Concept("Replication", java.util.List.of("read replica"))))));
        assertEquals(1.0, DesignScorer.score(rubric, s).stages().get(0).score());
    }

    @Test
    void irregularPluralsMatch() {
        Rubric rubric = new Rubric("manual", java.util.List.of(new Rubric.Stage("x", "X", 1, java.util.List.of(
                new Rubric.Concept("Aliases", java.util.List.of("custom alias")),
                new Rubric.Concept("Databases", java.util.List.of("databases")),
                new Rubric.Concept("Policy", java.util.List.of("eviction policy"))))));
        var r = DesignScorer.score(rubric, "The service should support custom aliases, and we keep the links in two database clusters with eviction policies tuned per tier.");
        assertEquals(java.util.List.of("Aliases", "Databases", "Policy"), r.stages().get(0).covered());
    }

    @Test
    void stemTermsMatchLongerWordsButShortTermsStayExact() {
        Rubric rubric = new Rubric("manual", java.util.List.of(new Rubric.Stage("x", "X", 1, java.util.List.of(
                new Rubric.Concept("Transcoding", java.util.List.of("transcod")),
                new Rubric.Concept("OT", java.util.List.of("ot"))))));
        var r = DesignScorer.score(rubric, "We run a transcoding pipeline for every upload and we store the other files too.");
        assertEquals(java.util.List.of("Transcoding"), r.stages().get(0).covered());   // "other" must not match "ot"
    }

    @Test
    void drafterAddsBoldTermsUnderTheirHeading() {
        String model = """
                ## High-level design
                Use a **token bucket** per user stored in **Redis**.
                ## Failure handling
                If Redis is down, **fail open** so traffic still flows.
                """;
        Rubric r = RubricDrafter.draft(model);
        var high = r.stages().stream().filter(s -> s.key().equals("highlevel")).findFirst().orElseThrow();
        var rel = r.stages().stream().filter(s -> s.key().equals("reliability")).findFirst().orElseThrow();
        assertTrue(high.concepts().stream().anyMatch(c -> c.name().equals("token bucket")));
        assertTrue(rel.concepts().stream().anyMatch(c -> c.name().equals("fail open")));
    }
}
