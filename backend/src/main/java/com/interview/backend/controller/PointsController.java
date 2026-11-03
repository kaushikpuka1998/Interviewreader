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
}
