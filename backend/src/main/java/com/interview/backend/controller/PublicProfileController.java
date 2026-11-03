package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Public progress page for a member. Only what a member would show on a CV: name,
 * join date and progress. Email, location and the flagged/important lists stay private.
 * Open to everyone (anyRequest permitAll), so it works while signed out.
 */
@RestController
@RequestMapping("/public/profiles")
@RequiredArgsConstructor
public class PublicProfileController {

    private final UserRepository users;
    private final UserProgressRepository progress;
    private final QuestionRepository questions;
    private final com.interview.backend.service.UsernameService usernames;
    private final com.interview.backend.repository.CodeSubmissionRepository submissions;
    private final com.interview.backend.repository.CodingProblemRepository codingProblems;

    @GetMapping("/{username}")
    public ResponseEntity<Map<String, Object>> profile(@PathVariable String username) {
        User u = usernames.resolve(username.toLowerCase()).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        Long id = u.getId();

        List<UserProgress> rows = progress.findByUserId(id);
        List<String> visited = rows.stream().filter(UserProgress::isVisited).map(UserProgress::getQuestionId).toList();
        List<String> solved = rows.stream().filter(UserProgress::isRead).map(UserProgress::getQuestionId).toList();
        List<Question> solvedQuestions = questions.findAllById(solved);

        Map<String, Long> solvedByTech = solvedQuestions.stream()
                .collect(Collectors.groupingBy(Question::getTech, Collectors.counting()));
        Map<String, Long> totalByTech = questions.countAllByTech().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        List<Map<String, Object>> byTech = new ArrayList<>();
        for (String tech : questions.findDistinctTechs()) {
            byTech.add(Map.of("tech", tech,
                    "total", totalByTech.getOrDefault(tech, 0L),
                    "solved", solvedByTech.getOrDefault(tech, 0L)));
        }

        Map<String, Long> solvedByDiff = solvedQuestions.stream().filter(q -> q.getDifficulty() != null)
                .collect(Collectors.groupingBy(Question::getDifficulty, Collectors.counting()));
        Map<String, Long> totalByDiff = questions.countAllByDifficulty().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        List<Map<String, Object>> byDifficulty = new ArrayList<>();
        for (String diff : questions.findDistinctDifficulties()) {
            byDifficulty.add(Map.of("difficulty", diff,
                    "total", totalByDiff.getOrDefault(diff, 0L),
                    "solved", solvedByDiff.getOrDefault(diff, 0L)));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", u.getUsername());
        body.put("name", u.getName() == null || u.getName().isBlank() ? "Learner" : u.getName());
        body.put("picture", u.effectivePicture());
        body.put("details", com.interview.backend.service.PublicDetails.view(u.getHeadline(), u.getCollege(), u.getGithubUser(), u.getLinkedinHandle(), u.getWebsiteUrl(), u.getBio(), u.getSkills()));
        body.put("memberSince", u.getCreatedAt());
        body.put("totalQuestions", questions.count());
        List<Question> visitedQuestions = questions.findAllById(visited);
        body.put("visitedCount", visitedQuestions.size());
        body.put("solvedCount", solvedQuestions.size());
        body.put("byTech", byTech);
        body.put("byDifficulty", byDifficulty);
        // The lists behind the Solved / Visited filter on the public page.
        body.put("solved", toItems(questions.findAllById(solved)));
        body.put("visited", toItems(visitedQuestions));
        body.put("coding", codingStats(u.getEmail()));
        return ResponseEntity.ok(body);
    }

    /** Coding practice: problems the member has an Accepted submission for, with totals per difficulty. */
    private Map<String, Object> codingStats(String email) {
        List<com.interview.backend.repository.CodingProblemRepository.Summary> all = codingProblems.findSummariesByOrderByIdAsc();
        java.util.Set<Long> accepted = submissions.findByUserEmailAndStatus(email, "Accepted").stream()
                .map(com.interview.backend.entity.CodeSubmission::getProblemId).collect(Collectors.toSet());
        Map<String, long[]> byDiff = new LinkedHashMap<>();   // difficulty -> {total, solved}
        List<Map<String, Object>> solved = new ArrayList<>();
        for (var p : all) {
            String d = p.getDifficulty() == null || p.getDifficulty().isBlank() ? "Other" : p.getDifficulty();
            long[] t = byDiff.computeIfAbsent(d, k -> new long[2]);
            t[0]++;
            if (accepted.contains(p.getId())) {
                t[1]++;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", p.getId());
                m.put("title", p.getTitle());
                m.put("difficulty", d);
                solved.add(m);
            }
        }
        List<Map<String, Object>> diffs = new ArrayList<>();
        byDiff.forEach((d, t) -> diffs.add(Map.of("difficulty", d, "total", t[0], "solved", t[1])));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", all.size());
        out.put("solvedCount", solved.size());
        out.put("byDifficulty", diffs);
        out.put("solved", solved);
        // Every submission time, so the calendar can show any past year (no code or problem details).
        out.put("activity", submissions.findByUserEmailAndCreatedAtAfter(email, java.time.Instant.EPOCH).stream()
                .map(x -> x.getCreatedAt().toString()).toList());
        return out;
    }

    private static List<Map<String, Object>> toItems(List<Question> qs) {
        return qs.stream().map(q -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("title", q.getTitle());
            m.put("tech", q.getTech());
            m.put("difficulty", q.getDifficulty());
            return m;
        }).toList();
    }
}
