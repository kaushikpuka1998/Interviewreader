package com.interview.backend.practice;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Drafts a rubric for a design question that has no hand-written one: the seven standard stages with generic concepts,
 * plus question-specific concepts taken from the model answer (its **bold** terms), placed in the stage of the heading
 * they appear under. Admins can edit the result; it is a starting point, not a verdict.
 */
public final class RubricDrafter {

    private static final int MAX_SPECIFIC_PER_STAGE = 6;
    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*\\n]{3,60})\\*\\*");
    private static final Pattern HEADING = Pattern.compile("^#{1,6}\\s+(.+)$");

    private RubricDrafter() {}

    /** The standard stages, in interview order, with weights and generic concepts. Shared with hand-written rubrics. */
    public static List<Rubric.Stage> standardStages() {
        return List.of(
                stage("requirements", "Requirements", 1.5,
                        c("Functional requirements", "functional requirement", "use case", "user can", "users can", "should support", "feature"),
                        c("Non-functional requirements", "non functional", "latency", "availability", "highly available", "scalability", "durability", "throughput"),
                        c("Scale assumptions", "daily active", "dau", "mau", "million users", "users per day", "scale")),
                stage("estimation", "Estimation", 1.0,
                        c("Traffic (QPS)", "qps", "rps", "requests per second", "read write ratio", "read heavy", "write heavy", "peak traffic"),
                        c("Storage", "storage", "terabyte", "petabyte", "gigabyte", "bytes per", "per year", "retention"),
                        c("Bandwidth", "bandwidth", "network", "egress")),
                stage("api", "API & data model", 1.5,
                        c("API design", "api", "endpoint", "rest", "grpc", "post", "get request", "websocket"),
                        c("Data model", "schema", "table", "data model", "primary key", "index", "entity"),
                        c("Database choice", "sql", "nosql", "postgres", "mysql", "cassandra", "dynamodb", "mongodb", "relational database")),
                stage("highlevel", "High-level design", 2.5,
                        c("Core components", "service", "load balancer", "api gateway", "microservice", "application server"),
                        c("Caching", "cache", "redis", "memcached", "cdn"),
                        c("Async processing", "queue", "kafka", "message broker", "pub sub", "worker", "event")),
                stage("scaling", "Deep dive & scaling", 1.5,
                        c("Partitioning", "shard", "sharding", "partition", "consistent hashing"),
                        c("Replication", "replica", "replication", "read replica", "leader follower", "primary secondary"),
                        c("Horizontal scaling", "horizontal scaling", "scale out", "scale horizontally", "autoscaling", "stateless")),
                stage("reliability", "Reliability & failure", 1.0,
                        c("Failure handling", "failover", "retry", "retries", "circuit breaker", "timeout", "backoff", "fallback"),
                        c("Monitoring", "monitoring", "metrics", "alert", "logging", "tracing", "observability"),
                        c("Consistency & idempotency", "idempotent", "idempotency", "exactly once", "at least once", "eventual consistency", "strong consistency")),
                stage("tradeoffs", "Trade-offs", 1.0,
                        c("Trade-offs discussed", "trade off", "tradeoff", "instead of", "versus", "downside", "pros and cons", "at the cost of"),
                        c("Alternatives compared", "alternative", "another option", "compared to", "could also", "we could"))
        );
    }

    public static Rubric draft(String modelAnswer) {
        List<Rubric.Stage> stages = new ArrayList<>(standardStages());
        Map<String, LinkedHashMap<String, Rubric.Concept>> specific = new LinkedHashMap<>();
        Set<String> seen = new HashSet<>();
        String stageKey = "highlevel";
        for (String line : (modelAnswer == null ? "" : modelAnswer).split("\\n")) {
            Matcher h = HEADING.matcher(line.trim());
            if (h.matches()) { stageKey = stageForHeading(h.group(1), stageKey); continue; }
            Matcher b = BOLD.matcher(line);
            while (b.find()) {
                String term = b.group(1).replaceAll("[:.,]+$", "").trim();
                String key = DesignScorer.normalise(term);
                if (key.length() < 3 || key.split(" ").length > 5 || isNotAConcept(term) || !seen.add(key) || isStageWord(key)) continue;
                var bucket = specific.computeIfAbsent(stageKey, k -> new LinkedHashMap<>());
                if (bucket.size() < MAX_SPECIFIC_PER_STAGE) bucket.put(key, new Rubric.Concept(term, termsFor(term)));
            }
        }
        for (int i = 0; i < stages.size(); i++) {
            Rubric.Stage s = stages.get(i);
            var extra = specific.get(s.key());
            if (extra == null || extra.isEmpty()) continue;
            List<Rubric.Concept> all = new ArrayList<>(s.concepts());
            all.addAll(extra.values());
            stages.set(i, new Rubric.Stage(s.key(), s.label(), s.weight(), all));
        }
        return new Rubric("auto", stages);
    }

    // "Token bucket / leaky bucket" -> both halves count; "Redis (sorted sets)" -> also "Redis".
    static List<String> termsFor(String term) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String part : term.split("\\s*/\\s*|\\s+or\\s+")) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            out.add(p);
            String noParens = p.replaceAll("\\s*\\(.*?\\)", "").trim();
            if (!noParens.isEmpty()) out.add(noParens);
        }
        return new ArrayList<>(out);
    }

    private static String stageForHeading(String heading, String current) {
        String h = heading.toLowerCase(Locale.ROOT);
        if (h.contains("requirement") || h.contains("scope") || h.contains("goal")) return "requirements";
        if (h.contains("estimat") || h.contains("capacity") || h.contains("back of")) return "estimation";
        if (h.contains("api") || h.contains("schema") || h.contains("data model") || h.contains("database")) return "api";
        if (h.contains("scal") || h.contains("shard") || h.contains("partition") || h.contains("deep")) return "scaling";
        if (h.contains("fail") || h.contains("reliab") || h.contains("fault") || h.contains("availab")) return "reliability";
        if (h.contains("trade")) return "tradeoffs";
        if (h.contains("high") || h.contains("architect") || h.contains("component") || h.contains("design") || h.contains("flow")) return "highlevel";
        return current;
    }

    // Bold words that are really section labels ("Requirements", "Trade-offs") aren't concepts of their own.
    private static boolean isStageWord(String key) {
        return Set.of("requirement", "requirements", "functional", "non functional", "estimation", "trade off", "trade offs",
                "tradeoffs", "challenges", "challenge", "summary", "example", "note", "flow", "api", "design").contains(key);
    }

    // Bold text in long model answers that is emphasis, not a concept a candidate would say: figures ("1.73 TB/day"),
    // section labels ("Phase 1 --- Foundation", "Goal"), questions and verdict words. Kept out so they don't show up
    // as "missed" points and drag scores down.
    private static final Pattern FIGURE = Pattern.compile("^[~≈$₹]?\\s*[\\d.,]+\\s*[%a-zA-Z/]{0,12}(\\s*/\\s*\\w+)?$");
    private static final Pattern LABEL = Pattern.compile("(?i)^(phase|step|stage|option|case|example|note|goal|problem|solution|result|answer|summary|"
            + "takeaway|rule|tip|important|key|why|what|how|when|pros|cons|yes|no|bad|good|better|best|wrong|correct|avoid|"
            + "do|don't|never|always|warning|caution|insight|interview|q\\d*|a\\d*|tl;dr|recommended|decision)\\b");
    static boolean isNotAConcept(String term) {
        String t = term.trim();
        return FIGURE.matcher(t).matches() || LABEL.matcher(t).find() || t.contains("---") || t.contains("—")
                || t.endsWith("?") || t.endsWith(":") || t.chars().filter(Character::isDigit).count() * 3 > t.length();
    }

    private static Rubric.Stage stage(String key, String label, double weight, Rubric.Concept... concepts) {
        return new Rubric.Stage(key, label, weight, List.of(concepts));
    }

    private static Rubric.Concept c(String name, String... terms) {
        return new Rubric.Concept(name, List.of(terms));
    }
}
