package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.PointsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** /api/points: the signed-in member's daily check-in, streak and points. */
@RestController
@RequestMapping("/points")
@RequiredArgsConstructor
public class PointsController {

    private final PointsService points;
    private final UserRepository users;
    private final com.interview.backend.repository.PointEventRepository events;
    private final com.interview.backend.repository.QuestionRepository questions;
    private final com.interview.backend.repository.CodingProblemRepository problems;

    private User me() {
        return users.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName()).orElseThrow();
    }

    /** Called by the app on the first visit of the day; safe to call repeatedly. */
    @PostMapping("/checkin")
    public Map<String, Object> checkIn() {
        return points.checkIn(me());
    }

    @GetMapping("/me")
    public Map<String, Object> mine() {
        return points.summary(me());
    }

    /** The streak page: the last 100 point events with what they were for, and the days checked in (for the calendar). */
    @GetMapping("/history")
    public Map<String, Object> history() {
        User u = me();
        var list = events.findTop100ByUserIdOrderByIdDesc(u.getId()).stream().map(e -> {
            String title = null;
            try {
                if ("read".equals(e.getKind())) title = questions.findById(e.getRef()).map(q -> q.getTitle()).orElse(null);
                else if ("solve".equals(e.getKind())) title = problems.findById(Long.valueOf(e.getRef())).map(p -> p.getTitle()).orElse(null);
            } catch (RuntimeException ignored) { /* a deleted or odd ref just has no title */ }
            var m = new java.util.LinkedHashMap<String, Object>();
            m.put("kind", e.getKind()); m.put("points", e.getPoints()); m.put("at", e.getCreatedAt());
            m.put("title", title != null ? title : "streak".equals(e.getKind()) ? e.getRef().split("@")[0] + "-day streak bonus" : null);
            return m;
        }).toList();
        var days = events.findTop60ByUserIdAndKindOrderByIdDesc(u.getId(), "login").stream().map(e -> e.getRef()).toList();
        return Map.of("events", list, "days", days);
    }
}
