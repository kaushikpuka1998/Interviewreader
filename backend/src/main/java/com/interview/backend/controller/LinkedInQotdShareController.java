package com.interview.backend.controller;

import com.interview.backend.entity.LinkedInQotdShare;
import com.interview.backend.entity.User;
import com.interview.backend.repository.LinkedInQotdShareRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.DailyQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** Tracks only confirmed sharing of the current QOTD, never arbitrary LinkedIn activity. */
@RestController
@RequestMapping("/linkedin-posts")
@RequiredArgsConstructor
public class LinkedInQotdShareController {
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private final UserRepository users;
    private final LinkedInQotdShareRepository shares;
    private final DailyQuestionService daily;

    private Long currentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return users.findByEmail(email).map(User::getId).orElseThrow();
    }

    @GetMapping("/progress")
    public Map<String, Object> progress() {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate start = today.minusDays(6);
        Set<LocalDate> shared = shares.findByUserIdAndPostedOnBetween(currentUserId(), start, today).stream()
                .map(LinkedInQotdShare::getPostedOn).collect(java.util.stream.Collectors.toSet());
        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(today); day = day.plusDays(1)) {
            days.add(Map.of("date", day.toString(), "shared", shared.contains(day)));
        }
        return Map.of("days", days, "count", shared.size(), "todayShared", shared.contains(today));
    }

    @PostMapping("/confirm")
    public ResponseEntity<?> confirm(@RequestBody Map<String, String> body) {
        String questionId = body.getOrDefault("questionId", "").trim();
        String todayQuestionId = String.valueOf(daily.today().get("id"));
        if (questionId.isEmpty() || !questionId.equals(todayQuestionId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only today's Question of the Day can be tracked."));
        }
        Long userId = currentUserId();
        LocalDate today = LocalDate.now(ZONE);
        LinkedInQotdShare share = shares.findByUserIdAndPostedOn(userId, today).orElseGet(() -> {
            LinkedInQotdShare row = new LinkedInQotdShare();
            row.setUserId(userId);
            row.setPostedOn(today);
            return row;
        });
        share.setQuestionId(questionId);
        shares.save(share);
        return ResponseEntity.ok(Map.of("confirmed", true));
    }
}
