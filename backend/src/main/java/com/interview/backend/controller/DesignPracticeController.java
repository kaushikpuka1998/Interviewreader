package com.interview.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.DesignAttempt;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.practice.DesignScorer;
import com.interview.backend.practice.PracticeService;
import com.interview.backend.practice.Rubric;
import com.interview.backend.practice.RubricService;
import com.interview.backend.repository.DesignAttemptRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserRepository;
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

    private static final int MAX_ANSWER_CHARS = 20_000;

    private final QuestionRepository questions;
    private final DesignAttemptRepository attempts;
    private final UserRepository users;
    private final RubricService rubrics;
    private final PracticeService practice;
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    public record AttemptInput(String answer, String mode, Integer durationSec, String difficulty) {}

    private User me() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
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
        out.put("quota", practice.quota(me()));
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
        if (answer.length() > MAX_ANSWER_CHARS) return ResponseEntity.badRequest().body(Map.of("error", "The answer is too long (20,000 characters max)."));
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
        a.setMode(Set.of("voice", "interview").contains(in.mode()) ? in.mode() : "text");
        a.setDifficulty(Set.of("soft", "hard").contains(in.difficulty()) ? in.difficulty() : "moderate");
        a.setDurationSec(in.durationSec() == null ? null : Math.max(0, Math.min(in.durationSec(), 6 * 3600)));
        a.setScore(result.score());
        a.setSource(source);
        try { a.setBreakdown(json.writeValueAsString(result)); } catch (Exception e) { a.setBreakdown("{}"); }
        attempts.save(a);
        Map<String, Object> out = view(a, q);
        out.put("quota", practice.quota(u));
        return ResponseEntity.ok(out);
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

    private Map<String, Object> view(DesignAttempt a, Question q) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("questionId", a.getQuestionId());
        out.put("title", q == null ? a.getQuestionId() : RubricService.textOf(q));
        out.put("answer", a.getAnswer());
        out.put("mode", a.getMode());
        out.put("difficulty", a.getDifficulty() == null ? "moderate" : a.getDifficulty());
        out.put("durationSec", a.getDurationSec());
        out.put("score", a.getScore());
        out.put("createdAt", a.getCreatedAt().toString());
        try { out.put("result", json.readTree(a.getBreakdown())); } catch (Exception e) { out.put("result", Map.of()); }
        // The model answer is part of the result: shown after an attempt, never before.
        out.put("modelAnswer", q == null || q.getAnswer() == null ? "" : q.getAnswer());
        return out;
    }
}
