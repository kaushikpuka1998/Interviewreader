package com.interview.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.ArchitectureSimulation;
import com.interview.backend.entity.DesignAttempt;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.practice.DesignScorer;
import com.interview.backend.practice.PracticeService;
import com.interview.backend.practice.Rubric;
import com.interview.backend.practice.RubricService;
import com.interview.backend.repository.DesignAttemptRepository;
import com.interview.backend.repository.ArchitectureSimulationRepository;
import com.interview.backend.repository.FeatureFlagRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Solo system design practice (/api/practice/design): answer a "Design …" question alone and get a coverage score
 * out of 10. Signed-in members only (SecurityConfig). The rubric is only revealed with a result, never before.
 */
@RestController
@RequestMapping("/practice/design")
@RequiredArgsConstructor
public class DesignPracticeController {

    // A 60-minute spoken interview transcribes to about 9,000 words (~55,000 characters); this leaves room for two hours.
    private static final int MAX_ANSWER_CHARS = 120_000;

    private final QuestionRepository questions;
    private final DesignAttemptRepository attempts;
    private final ArchitectureSimulationRepository simulations;
    private final FeatureFlagRepository featureFlags;
    private final UserRepository users;
    private final RubricService rubrics;
    private final PracticeService practice;
    private final BillingService billing;
    private final com.interview.backend.practice.InterviewBanks banks;
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    public record AttemptInput(String answer, String mode, Integer durationSec, String difficulty, List<Map<String, Object>> signals) {}

    private User me() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    private Map<String, Object> simulationQuota(User user) {
        long used = simulations.countByUserId(user.getId());
        boolean premium = billing.isPremium(user);
        Map<String, Object> quota = new LinkedHashMap<>();
        quota.put("premium", premium);
        quota.put("freeTotal", 3);
        quota.put("used", used);
        quota.put("freeLeft", premium ? 0 : Math.max(0, 3 - used));
        quota.put("canSimulate", premium || used < 3);
        return quota;
    }

    /** Every design question, with the member's best score and attempt count on each. */
    @GetMapping("/questions")
    public List<Map<String, Object>> list() {
        User u = me();
        Map<String, double[]> mine = new HashMap<>();   // questionId -> {best, count}
        for (DesignAttempt a : attempts.findByUserId(u.getId())) {
            double[] s = mine.computeIfAbsent(a.getQuestionId(), k -> new double[]{0, 0});
            s[0] = Math.max(s[0], a.getScore() == null ? 0 : a.getScore());
            s[1]++;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Question q : questions.findByTech("hld")) {
            if (!RubricService.isDesignQuestion(q)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", q.getId());
            row.put("title", RubricService.textOf(q));
            row.put("difficulty", q.getDifficulty() == null ? "" : q.getDifficulty());
            row.put("curated", q.getRubric() != null && q.getRubric().contains("\"source\":\"manual\""));
            double[] s = mine.get(q.getId());
            row.put("best", s == null ? null : s[0]);
            row.put("attempts", s == null ? 0 : (int) s[1]);
            out.add(row);
        }
        return out;
    }

    /** One question to practise: its text and the stage outline (what to cover, not the checklist). */
    @GetMapping("/questions/{id}")
    public ResponseEntity<?> question(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        Rubric r = rubrics.rubricFor(q);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", q.getId());
        out.put("title", RubricService.textOf(q));
        out.put("difficulty", q.getDifficulty() == null ? "" : q.getDifficulty());
        out.put("stages", r.stages().stream().map(s -> Map.of("key", s.key(), "label", s.label())).toList());
        out.put("scale", userScale(q.getAnswer()));
        out.put("challenges", challenges(q.getAnswer()));
        out.put("bank", banks.of(q));
        out.put("followUps", followUps(q.getAnswer()));
        User user = me();
        out.put("quota", practice.quota(user));
        out.put("simulationQuota", simulationQuota(user));
        return ResponseEntity.ok(out);
    }

    public record ProbeInput(String answer) {}

    /**
     * Interview mode: how far the answer so far covers each stage, so the interviewer knows what to ask next.
     * Free (no attempt used); returns only stage scores and one missed point per stage to ask about, not the checklist.
     */
    @PostMapping("/questions/{id}/probe")
    public ResponseEntity<?> probe(@PathVariable String id, @RequestBody ProbeInput in) {
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        String answer = in == null || in.answer() == null ? "" : in.answer();
        if (answer.length() > MAX_ANSWER_CHARS) answer = answer.substring(0, MAX_ANSWER_CHARS);
        // ponytail: unmetered; someone could probe repeatedly to map a rubric. Rate-limit per user if that shows up.
        DesignScorer.Result r = DesignScorer.score(rubrics.rubricFor(q), answer);
        List<Map<String, Object>> stages = r.stages().stream().map(st -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", st.key());
            m.put("label", st.label());
            m.put("score", st.score());
            m.put("missed", st.missed().isEmpty() ? null : st.missed().get(0));
            return m;
        }).toList();
        return ResponseEntity.ok(Map.of("stages", stages));
    }

    /** Score an answer: uses one attempt (free first, then the plan), stores it, and returns the full result. */
    @PostMapping("/questions/{id}/attempts")
    public ResponseEntity<?> attempt(@PathVariable String id, @RequestBody AttemptInput in) {
        User u = me();
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        String answer = in == null || in.answer() == null ? "" : in.answer().strip();
        if (answer.length() < 20) return ResponseEntity.badRequest().body(Map.of("error", "Write or speak your answer first."));
        if (answer.length() > MAX_ANSWER_CHARS) return ResponseEntity.badRequest().body(Map.of("error", "The answer is too long (120,000 characters max)."));
        String source;
        try { source = practice.chargeNextAttempt(u); }
        catch (PracticeService.OutOfAttempts e) {
            return ResponseEntity.status(402).body(Map.of("error", e.getMessage(), "quota", practice.quota(u)));
        }
        DesignScorer.Result result = DesignScorer.score(rubrics.rubricFor(q), answer);
        DesignAttempt a = new DesignAttempt();
        a.setUserId(u.getId());
        a.setQuestionId(q.getId());
        a.setAnswer(answer);
        a.setMode("voice".equals(in.mode()) || "interview".equals(in.mode()) ? in.mode() : "text");   // Set.of().contains(null) throws
        a.setDifficulty("soft".equals(in.difficulty()) || "hard".equals(in.difficulty()) ? in.difficulty() : "moderate");
        if (in.signals() != null && !in.signals().isEmpty()) {
            try { a.setSignals(json.writeValueAsString(in.signals().stream().limit(20).toList())); } catch (Exception ignored) { }
        }
        a.setDurationSec(in.durationSec() == null ? null : Math.max(0, Math.min(in.durationSec(), 6 * 3600)));
        a.setScore(result.score());
        a.setSource(source);
        try { a.setBreakdown(json.writeValueAsString(result)); } catch (Exception e) { a.setBreakdown("{}"); }
        attempts.save(a);
        Map<String, Object> out = view(a, q);
        out.put("quota", practice.quota(u));
        return ResponseEntity.ok(out);
    }

    public record SimulationInput(List<Map<String, Object>> nodes, List<List<String>> edges, Long targetRps, Boolean referenceTemplate) {}

    /** Deterministic architecture simulation for the design canvas. It complements the verbal rubric score. */
    @PostMapping("/questions/{id}/simulate")
    public ResponseEntity<?> simulate(@PathVariable String id, @RequestBody SimulationInput in) {
        if (!featureFlags.findById("hld_simulation").map(flag -> flag.isEnabled()).orElse(true)) {
            return ResponseEntity.status(404).body(Map.of("error", "HLD architecture simulation is currently unavailable."));
        }
        Question q = questions.findById(id).orElse(null);
        if (q == null || !RubricService.isDesignQuestion(q)) return ResponseEntity.notFound().build();
        User user = me();
        long simulationsUsed = simulations.countByUserId(user.getId());
        if (!billing.isPremium(user) && simulationsUsed >= 3) {
            return ResponseEntity.status(402).body(Map.of(
                    "error", "You've used your 3 free architecture simulations. Upgrade to Premium for unlimited simulations.",
                    "simulationQuota", simulationQuota(user)));
        }
        Set<String> types = new HashSet<>();
        if (in != null && in.nodes() != null) for (Map<String, Object> n : in.nodes()) {
            Object type = n.get("type");
            if (type != null) types.add(type.toString().toLowerCase(Locale.ROOT));
        }
        long target = in == null || in.targetRps() == null ? 10_000L : Math.max(1, Math.min(in.targetRps(), 10_000_000_000L));
        boolean cache = types.contains("redis") || types.contains("cache");
        boolean replica = types.contains("read-replica") || types.contains("replica");
        boolean queue = types.contains("queue") || types.contains("kafka");
        boolean cqrs = types.contains("cqrs");
        boolean lb = types.contains("load-balancer") || types.contains("gateway");
        boolean shard = types.contains("shard") || types.contains("sharding");
        Set<String> links = new HashSet<>();
        if (in != null && in.edges() != null) for (List<String> edge : in.edges()) {
            if (edge != null && edge.size() >= 2 && edge.get(0) != null && edge.get(1) != null) {
                links.add(edge.get(0).toLowerCase(Locale.ROOT) + "->" + edge.get(1).toLowerCase(Locale.ROOT));
            }
        }
        boolean referenceTopology = types.containsAll(Set.of("client", "gateway", "load-balancer", "service", "redis", "cqrs", "read-replica", "queue", "database", "sharding"))
                && links.containsAll(Set.of("client->gateway", "gateway->load-balancer", "load-balancer->service", "service->redis", "service->cqrs", "cqrs->read-replica", "service->queue", "queue->database", "database->sharding"));
        boolean messagingTopology = types.containsAll(Set.of("client", "gateway", "websocket gateway", "presence", "fanout", "kafka", "redis", "database", "sharding", "asset storage", "monitoring"))
                && links.containsAll(Set.of("client->gateway", "gateway->websocket gateway", "websocket gateway->fanout", "fanout->kafka", "kafka->database", "database->sharding"));
        boolean marketplaceTopology = types.containsAll(Set.of("client", "gateway", "load-balancer", "service", "redis", "queue", "database", "read-replica", "asset storage", "sharding", "monitoring"))
                && links.containsAll(Set.of("client->gateway", "gateway->load-balancer", "load-balancer->service", "service->asset storage", "service->queue", "queue->database", "database->sharding"));
        boolean socialTopology = types.containsAll(Set.of("client", "gateway", "load-balancer", "service", "fanout", "kafka", "redis", "read-replica", "database", "sharding", "monitoring"))
                && links.containsAll(Set.of("client->gateway", "gateway->load-balancer", "load-balancer->service", "service->fanout", "fanout->kafka", "kafka->database", "database->sharding"));
        boolean completeBlueprint = Boolean.TRUE.equals(in == null ? null : in.referenceTemplate()) || referenceTopology || messagingTopology || marketplaceTopology || socialTopology;
        double hitRate = cache ? (completeBlueprint ? 0.9998 : (target >= 1_000_000 ? 0.92 : 0.78)) : 0;
        double dbReads = target * (1 - hitRate) * (cqrs || replica ? 0.35 : 1);
        double capacity = 20_000;
        if (lb) capacity *= 5;
        if (cache) capacity *= 4;
        if (replica || cqrs) capacity *= 3;
        if (queue) capacity *= 2;
        if (shard) capacity *= 12;
        if (completeBlueprint) capacity = 1_500_000_000d;
        List<String> findings = new ArrayList<>();
        if (!cache && target > 20_000) findings.add("Add Redis or a CDN: every read reaches the database at this traffic.");
        if (!replica && !cqrs && target > 100_000) findings.add("Add read replicas or CQRS to separate read traffic from the primary database.");
        if (!queue && target > 50_000) findings.add("Add a queue for bursty writes and asynchronous work.");
        if (!lb) findings.add("Add a load balancer or API gateway before scaling application instances.");
        if (!shard && dbReads > 100_000) findings.add("Plan sharding or partitioning: the remaining database read load is still too high.");
        boolean handles = target <= capacity;
        if (!handles) findings.add("Increase the design's serving capacity or lower the target request rate; the current estimate is below the selected load.");
        List<Map<String, Object>> tests = List.of(
                Map.of("name", "Request routing", "passed", completeBlueprint || lb, "detail", completeBlueprint ? "The loaded question-aware template routes traffic through its appropriate ingress path." : lb ? "Load is distributed before reaching application services." : "No load balancer or gateway is present."),
                Map.of("name", "Read-path protection", "passed", completeBlueprint || target <= 20_000 || cache, "detail", completeBlueprint ? "The loaded template uses the correct read or realtime delivery path for this question." : cache ? "Cache absorbs repeated reads before the database." : "At this traffic every read reaches the database."),
                Map.of("name", "Database scaling", "passed", completeBlueprint || dbReads <= 100_000 && (target <= 100_000 || replica || cqrs), "detail", completeBlueprint ? "The question-aware blueprint protects and partitions durable storage for this workload." : (replica || cqrs) ? "Read replicas/CQRS reduce primary database pressure." : "Add read replicas or CQRS for sustained read traffic."),
                Map.of("name", "Burst resilience", "passed", completeBlueprint || target <= 50_000 || queue, "detail", completeBlueprint ? "The loaded template includes the appropriate asynchronous or realtime delivery mechanism." : queue ? "Queue buffers asynchronous work and write bursts." : "Add a queue for bursty writes."),
                Map.of("name", "Target capacity", "passed", handles, "detail", handles ? "Estimated capacity covers the selected request target." : "Estimated capacity is below the target; add sharding or more scale primitives.")
        );
        ArchitectureSimulation usage = new ArchitectureSimulation();
        usage.setUserId(user.getId());
        usage.setQuestionId(q.getId());
        simulations.save(usage);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("targetRps", target);
        response.put("estimatedCapacityRps", (long) capacity);
        response.put("handlesTarget", handles);
        response.put("cacheHitRate", Math.round(hitRate * 100));
        response.put("estimatedDbReadsPerSecond", Math.round(dbReads));
        response.put("queueEnabled", queue);
        response.put("cqrsEnabled", cqrs);
        response.put("findings", findings);
        response.put("tests", tests);
        response.put("score", Math.min(10, Math.round((types.size() + (cache ? 2 : 0) + (replica || cqrs ? 2 : 0) + (queue ? 1 : 0) + (lb ? 1 : 0) + (shard ? 2 : 0)) * 10) / 10.0));
        response.put("simulationQuota", simulationQuota(user));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/attempts")
    public List<Map<String, Object>> history() {
        User u = me();
        Map<String, String> titles = new HashMap<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (DesignAttempt a : attempts.findTop50ByUserIdOrderByCreatedAtDesc(u.getId())) {
            String title = titles.computeIfAbsent(a.getQuestionId(), qid -> questions.findById(qid).map(RubricService::textOf).orElse(qid));
            out.add(Map.of("id", a.getId(), "questionId", a.getQuestionId(), "title", title, "score", a.getScore(),
                    "mode", a.getMode() == null ? "text" : a.getMode(), "createdAt", a.getCreatedAt().toString(),
                    "difficulty", a.getDifficulty() == null ? "moderate" : a.getDifficulty()));
        }
        return out;
    }

    @GetMapping("/attempts/{id}")
    public ResponseEntity<?> attempt(@PathVariable Long id) {
        User u = me();
        return attempts.findByIdAndUserId(id, u.getId())
                .<ResponseEntity<?>>map(a -> ResponseEntity.ok(view(a, questions.findById(a.getQuestionId()).orElse(null))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/quota")
    public Map<String, Object> quota() {
        return practice.quota(me());
    }

    private static final java.util.regex.Pattern USER_FIGURE = java.util.regex.Pattern.compile(
            "(?i)(\\d+(?:\\.\\d+)?)\\s*(k|m|b|thousand|million|billion)?\\+?\\s*(dau|mau|daily active|monthly active|registered|users)\\b");
    private static final java.util.regex.Pattern READ_WRITE = java.util.regex.Pattern.compile(
            "(?i)(?:read[^\\n]{0,40}?(\\d+)\\s*:\\s*1|(\\d+)\\s*:\\s*1[^\\n]{0,20}read)");

    /**
     * Interview mode: the user numbers to give when the candidate asks "what's the DAU / MAU?". Taken from the model
     * answer where it states them; the rest derived with the usual ratios (DAU ≈ half of MAU ≈ 10% of registered).
     * Only the inputs: QPS and storage are for the candidate to work out.
     */
    static Map<String, Object> userScale(String modelAnswer) {
        long dau = 0, mau = 0, users = 0;
        String readWrite = null;
        if (modelAnswer != null) {
            var m = USER_FIGURE.matcher(modelAnswer);
            while (m.find()) {
                double n = Double.parseDouble(m.group(1));
                String unit = m.group(2) == null ? "" : m.group(2).toLowerCase(Locale.ROOT);
                long v = (long) (n * switch (unit) { case "k", "thousand" -> 1e3; case "m", "million" -> 1e6; case "b", "billion" -> 1e9; default -> 1; });
                if (v < 1000) continue;   // "10 users" in an example, not the scale
                String kind = m.group(3).toLowerCase(Locale.ROOT);
                if ((kind.equals("dau") || kind.equals("daily active")) && dau == 0) dau = v;
                else if ((kind.equals("mau") || kind.equals("monthly active")) && mau == 0) mau = v;
                else if ((kind.equals("users") || kind.equals("registered")) && users == 0) users = v;
            }
            var rw = READ_WRITE.matcher(modelAnswer);
            if (rw.find()) readWrite = (rw.group(1) != null ? rw.group(1) : rw.group(2)) + ":1";
        }
        boolean stated = dau > 0 || mau > 0 || users > 0;
        if (dau == 0) dau = mau > 0 ? mau / 2 : users > 0 ? users / 10 : 10_000_000L;
        if (mau == 0) mau = dau * 2;
        if (users == 0) users = dau * 10;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dau", dau);
        out.put("mau", mau);
        out.put("users", Math.max(users, mau));
        out.put("readWrite", readWrite);
        out.put("fromModelAnswer", stated);
        return out;
    }

    private static final java.util.regex.Pattern CHALLENGES_LINE = java.util.regex.Pattern.compile("(?i)\\*\\*challenges?\\*\\*\\s*:?\\s*([^\\n]+)");
    private static final java.util.regex.Pattern DEEP_DIVE_HEADING = java.util.regex.Pattern.compile("(?im)^#{1,4}\\s*(?:\\d+\\.\\s*)?deep dive\\s*:\\s*(.+)$");

    /**
     * Interview mode: this design's hard parts, so the interviewer can ask about them by name ("How would you handle the
     * celebrity problem?"). From the model answer's "**Challenges**:" list, else its "Deep dive: …" headings. Names only.
     */
    static List<String> challenges(String modelAnswer) {
        if (modelAnswer == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        var m = CHALLENGES_LINE.matcher(modelAnswer);
        if (m.find()) {
            // Split on commas that are not inside parentheses: "timeline generation (hybrid fan-out), celebrity problem".
            StringBuilder cur = new StringBuilder();
            int depth = 0;
            for (char c : (m.group(1) + ",").toCharArray()) {
                if (c == '(') depth++;
                if (c == ')') depth = Math.max(0, depth - 1);
                if (c == ',' && depth == 0) { add(out, cur.toString()); cur.setLength(0); } else cur.append(c);
            }
        }
        var h = DEEP_DIVE_HEADING.matcher(modelAnswer);
        while (h.find()) add(out, h.group(1));
        return out.stream().limit(6).toList();
    }

    private static final java.util.regex.Pattern QUESTION_HEADING =
            java.util.regex.Pattern.compile("(?m)^#{2,5}\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s+)?(?:Q\\d*[:.]\\s*)?([^\\n#]{12,160}\\?)\\s*$");

    /**
     * Interview mode: the follow-up questions the current model answer itself poses, i.e. headings ending in "?"
     * ("## 20.1 How do you prevent double booking?"). Read from the answer on every request, so when an answer is
     * rewritten the interviewer's questions follow it.
     */
    static List<String> followUps(String modelAnswer) {
        if (modelAnswer == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        var m = QUESTION_HEADING.matcher(modelAnswer.replaceAll("(?s)```.*?```", ""));
        while (m.find() && out.size() < 15) {
            String q = m.group(1).replaceAll("[*`_]", "").replaceAll("\\s+", " ").strip();
            String lower = q.toLowerCase(Locale.ROOT);
            // Definitions ("What is idempotency?") are study questions, not interviewer follow-ups.
            if (lower.startsWith("why this") || lower.matches("^what (is|are) (a |an |the )?[\\w-]+( [\\w-]+){0,4}\\?$") || q.split(" ").length < 3) continue;
            out.add(sentenceCase(q));
        }
        return new ArrayList<>(out);
    }

    /** "Why Use a Search Engine?" -> "Why use a search engine?" (acronyms like API or CDN stay as they are). */
    static String sentenceCase(String q) {
        String[] w = q.split(" ");
        long capitalised = java.util.Arrays.stream(w).skip(1).filter(x -> !x.isEmpty() && Character.isUpperCase(x.charAt(0))).count();
        if (w.length < 3 || capitalised * 2 < w.length - 1) return q;
        StringBuilder b = new StringBuilder(w[0]);
        for (int i = 1; i < w.length; i++) b.append(' ').append(w[i].equals(w[i].toUpperCase(Locale.ROOT)) ? w[i] : w[i].toLowerCase(Locale.ROOT));
        return b.toString();
    }

    private static void add(Set<String> out, String raw) {
        String item = raw.replaceAll("[*`_]", "").replaceAll("\\.\\s*$", "").replaceAll("\\s+", " ").strip();
        if (item.length() >= 4 && item.length() <= 120) out.add(item);
    }

    private Map<String, Object> view(DesignAttempt a, Question q) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("questionId", a.getQuestionId());
        out.put("title", q == null ? a.getQuestionId() : RubricService.textOf(q));
        out.put("answer", a.getAnswer());
        out.put("mode", a.getMode());
        out.put("difficulty", a.getDifficulty() == null ? "moderate" : a.getDifficulty());
        try { out.put("signals", a.getSignals() == null ? List.of() : json.readTree(a.getSignals())); } catch (Exception e) { out.put("signals", List.of()); }
        out.put("durationSec", a.getDurationSec());
        out.put("score", a.getScore());
        out.put("createdAt", a.getCreatedAt().toString());
        try { out.put("result", json.readTree(a.getBreakdown())); } catch (Exception e) { out.put("result", Map.of()); }
        // The model answer is part of the result: shown after an attempt, never before.
        out.put("modelAnswer", q == null || q.getAnswer() == null ? "" : q.getAnswer());
        return out;
    }
}
