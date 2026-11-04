package com.interview.backend.service;

import com.interview.backend.entity.CodingProblem;
import com.interview.backend.entity.DesignAttempt;
import com.interview.backend.entity.MockInterview;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.CodeSubmissionRepository;
import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.DesignAttemptRepository;
import com.interview.backend.repository.MockInterviewRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Personal skill gap analysis: where a member is weak, from what they actually did: questions read per topic, coding problems attempted
 * and solved per pattern, system design practice scores and mock interview ratings. It also says what to learn next. Nothing here is
 * stored; it is worked out from the member's own history each time the page opens.
 */
@Service
public class SkillGapService {

    private static final Map<String, String> TECH_LABELS = Map.ofEntries(
            Map.entry("java", "Java"), Map.entry("react", "React"), Map.entry("node", "Node.js"), Map.entry("sql", "SQL"),
            Map.entry("hld", "System Design (HLD)"), Map.entry("design-patterns", "Design Patterns (LLD)"), Map.entry("kafka", "Kafka"),
            Map.entry("golang", "Go"), Map.entry("microservices", "Microservices"), Map.entry("rails", "Rails"),
            Map.entry("angular", "Angular"), Map.entry("behavioral", "Behavioral"), Map.entry("misc", "Misc"));
    private static final List<String> DIFFICULTY_ORDER = List.of("Basic", "Intermediate", "Advanced", "Experienced");

    private final QuestionRepository questions;
    private final UserProgressRepository progress;
    private final CodeSubmissionRepository submissions;
    private final CodingProblemRepository problems;
    private final DesignAttemptRepository design;
    private final MockInterviewRepository mocks;

    public SkillGapService(QuestionRepository questions, UserProgressRepository progress, CodeSubmissionRepository submissions,
                           CodingProblemRepository problems, DesignAttemptRepository design, MockInterviewRepository mocks) {
        this.questions = questions;
        this.progress = progress;
        this.submissions = submissions;
        this.problems = problems;
        this.design = design;
        this.mocks = mocks;
    }

    public Map<String, Object> analyse(User u) {
        Map<String, Object> out = new LinkedHashMap<>();

        // ---- questions read, per topic ----
        Map<String, String> techOf = new HashMap<>();
        Map<String, Integer> total = new TreeMap<>();
        for (Object[] r : questions.idTitlesTechs()) { techOf.put((String) r[0], (String) r[2]); total.merge((String) r[2], 1, Integer::sum); }
        Map<String, int[]> mine = new HashMap<>();   // tech -> {read, visited (not read), flagged}
        Set<String> readIds = new HashSet<>();
        for (UserProgress p : progress.findByUserId(u.getId())) {
            String tech = techOf.get(p.getQuestionId());
            if (tech == null) continue;
            int[] c = mine.computeIfAbsent(tech, k -> new int[3]);
            if (p.isRead()) { c[0]++; readIds.add(p.getQuestionId()); } else if (p.isVisited()) c[1]++;
            if (p.isFlagged()) c[2]++;
        }
        List<Map<String, Object>> topics = new ArrayList<>();
        total.forEach((tech, n) -> {
            int[] c = mine.getOrDefault(tech, new int[3]);
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("tech", tech); t.put("label", TECH_LABELS.getOrDefault(tech, tech)); t.put("total", n);
            t.put("read", c[0]); t.put("visited", c[1]); t.put("flagged", c[2]);
            t.put("percent", Math.round(100.0 * c[0] / n));
            topics.add(t);
        });
        topics.sort(Comparator.comparingLong(t -> (Long) t.get("percent")));
        out.put("topics", topics);

        // ---- coding practice, per pattern ----
        Map<Long, boolean[]> outcome = new HashMap<>();   // problemId -> {attempted, solved}
        for (Object[] r : submissions.problemOutcomes(u.getEmail())) {
            boolean[] o = outcome.computeIfAbsent(((Number) r[0]).longValue(), k -> new boolean[2]);
            o[0] = true;
            if ("Accepted".equalsIgnoreCase((String) r[1])) o[1] = true;
        }
        var summaries = problems.findSummariesByOrderByIdAsc();
        Map<String, int[]> byTopic = new HashMap<>();   // topic -> {total, attempted, solved}
        int attempted = 0, solved = 0;
        for (var s : summaries) {
            boolean[] o = outcome.getOrDefault(s.getId(), new boolean[2]);
            if (o[0]) attempted++;
            if (o[1]) solved++;
            for (String t : csv(s.getTopics())) {
                int[] c = byTopic.computeIfAbsent(t, k -> new int[3]);
                c[0]++; if (o[0]) c[1]++; if (o[1]) c[2]++;
            }
        }
        List<Map<String, Object>> coding = new ArrayList<>();
        byTopic.forEach((t, c) -> {
            if (c[0] < 3) return;   // too few problems for the percentage to mean anything
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("topic", t); m.put("total", c[0]); m.put("attempted", c[1]); m.put("solved", c[2]);
            m.put("solveRate", c[1] == 0 ? null : Math.round(100.0 * c[2] / c[1]));
            m.put("percent", Math.round(100.0 * c[2] / c[0]));   // share of the whole pattern solved
            coding.add(m);
        });
        coding.sort(Comparator.comparingLong(m -> (Long) m.get("percent")));
        out.put("coding", Map.of("byTopic", coding, "attempted", attempted, "solved", solved, "total", summaries.size()));

        // ---- system design practice ----
        List<DesignAttempt> da = new ArrayList<>(design.findTop50ByUserIdOrderByCreatedAtDesc(u.getId()));
        Collections.reverse(da);   // oldest first, so the chart reads left to right
        double avg = da.stream().filter(a -> a.getScore() != null).mapToDouble(DesignAttempt::getScore).average().orElse(0);
        List<Map<String, Object>> recent = new ArrayList<>();
        for (DesignAttempt a : da.subList(Math.max(0, da.size() - 10), da.size()))
            recent.add(Map.of("score", a.getScore() == null ? 0 : Math.round(a.getScore() * 10) / 10.0, "at", a.getCreatedAt().toString()));
        out.put("design", Map.of("attempts", da.size(), "average", Math.round(avg * 10) / 10.0, "recent", recent));

        // ---- mock interviews (as the candidate) ----
        Map<String, List<Integer>> ratings = new TreeMap<>();
        List<String> improve = new ArrayList<>();
        for (MockInterview m : mocks.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(u.getId(), u.getId())) {
            if (!Objects.equals(m.getCandidateId(), u.getId()) || m.getFeedbackRating() == null) continue;
            ratings.computeIfAbsent(m.getType(), k -> new ArrayList<>()).add(m.getFeedbackRating());
            if (improve.size() < 3 && m.getFeedbackImprove() != null && !m.getFeedbackImprove().isBlank()) improve.add(m.getFeedbackImprove().trim());
        }
        List<Map<String, Object>> mockByType = new ArrayList<>();
        ratings.forEach((type, list) -> mockByType.add(Map.of("type", type, "count", list.size(),
                "average", Math.round(list.stream().mapToInt(Integer::intValue).average().orElse(0) * 10) / 10.0)));
        out.put("mock", Map.of("byType", mockByType, "improve", improve));

        // ---- focus areas and what to learn next ----
        // Things the member has actually worked on and is weak at come first; topics not started yet only fill the space that is left.
        List<Map<String, Object>> focus = new ArrayList<>();
        List<Map<String, Object>> notStarted = new ArrayList<>();
        List<String> weakTechs = new ArrayList<>();
        for (var t : topics) {
            long pct = (Long) t.get("percent"); int total_ = (Integer) t.get("total");
            int started = (Integer) t.get("read") + (Integer) t.get("visited");
            if (total_ < 5) continue;
            if (started > 0 && pct < 50) {
                focus.add(area("topic", (String) t.get("label"), pct, "You started " + t.get("label") + " but have read only " + pct + "% of it.", "/?tech=" + t.get("tech")));
                weakTechs.add((String) t.get("tech"));
            } else if (started == 0 && total_ >= 20 && !"behavioral".equals(t.get("tech"))) {
                notStarted.add(area("topic", (String) t.get("label"), 0L, "Not started: " + total_ + " questions waiting.", "/?tech=" + t.get("tech")));
            }
        }
        String weakPattern = null;
        for (var m : coding) {
            int att = (Integer) m.get("attempted"); Object rate = m.get("solveRate");
            if (att >= 2 && rate != null && (Long) rate < 50) {
                focus.add(area("coding", (String) m.get("topic"), (Long) rate, "You solved " + rate + "% of the " + m.get("topic") + " problems you tried.", "/problems?topic=" + java.net.URLEncoder.encode((String) m.get("topic"), java.nio.charset.StandardCharsets.UTF_8)));
                if (weakPattern == null) weakPattern = (String) m.get("topic");
            }
        }
        if (da.size() >= 2 && avg < 6) focus.add(area("design", "System design practice", Math.round(avg * 10), "Your design practice average is " + (Math.round(avg * 10) / 10.0) + " out of 10.", "/interview/practice"));
        for (var m : mockByType) if ((Double) m.get("average") < 3) focus.add(area("mock", "Mock interview: " + m.get("type"), Math.round((Double) m.get("average") * 20), "Average interviewer rating " + m.get("average") + " out of 5.", "/interview"));
        for (var n : notStarted) { if (focus.size() >= 8) break; focus.add(n); }
        if (weakTechs.isEmpty()) for (var n : notStarted.subList(0, Math.min(2, notStarted.size()))) weakTechs.add(((String) n.get("url")).substring("/?tech=".length()));
        out.put("focus", focus.size() > 8 ? focus.subList(0, 8) : focus);

        List<Map<String, Object>> next = new ArrayList<>();
        for (String tech : weakTechs.subList(0, Math.min(2, weakTechs.size()))) {
            int added = 0;
            for (Object[] r : questions.topicQuestions(tech, "", PageRequest.of(0, 400))) {
                if (readIds.contains((String) r[0])) continue;
                next.add(Map.of("type", "question", "id", r[0], "title", String.valueOf(r[2] == null || ((String) r[2]).isBlank() ? r[1] : r[2]),
                        "slug", ShareSlug.of((String) r[1]), "reason", TECH_LABELS.getOrDefault(tech, tech) + ": next unread"));
                if (++added == 3) break;
            }
        }
        if (weakPattern == null && !coding.isEmpty()) {   // nothing failing: suggest the pattern with the least done
            for (var m : coding) if ((Integer) m.get("attempted") == 0) { weakPattern = (String) m.get("topic"); break; }
        }
        if (weakPattern != null) {
            final String pattern = weakPattern;
            summaries.stream()
                    .filter(s -> csv(s.getTopics()).contains(pattern) && !outcome.getOrDefault(s.getId(), new boolean[2])[1])
                    .sorted(Comparator.comparingInt(s -> DIFFICULTY_ORDER.indexOf(s.getDifficulty())))
                    .limit(4)
                    .forEach(s -> next.add(Map.of("type", "problem", "id", s.getId(), "title", s.getTitle(), "reason", pattern + ": try next")));
        }
        out.put("next", next);
        return out;
    }

    private static Map<String, Object> area(String kind, String name, long percent, String reason, String url) {
        return Map.of("kind", kind, "name", name, "percent", percent, "reason", reason, "url", url);
    }

    private static List<String> csv(String s) {
        return s == null || s.isBlank() ? List.of() : Arrays.stream(s.split(",")).map(String::trim).toList();
    }
}
