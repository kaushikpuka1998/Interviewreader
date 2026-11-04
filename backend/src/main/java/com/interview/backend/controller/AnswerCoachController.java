package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.practice.AnswerCoach;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.service.AccessService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/** Timed answer practice on any question: the member's answer is checked against the model answer's key points. */
@RestController
@RequestMapping("/practice/answer")
public class AnswerCoachController {

    private static final int MAX_CHARS = 20_000;

    public record Input(String answer, Integer seconds) {}

    private final QuestionRepository questions;
    private final AccessService access;

    public AnswerCoachController(QuestionRepository questions, AccessService access) {
        this.questions = questions;
        this.access = access;
    }

    @PostMapping("/{id}")
    public ResponseEntity<?> check(@PathVariable String id, @RequestBody Input in) {
        Question q = questions.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();
        if (!access.canRead(q.getTech())) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "signup_required"));
        if (access.isLocked(q, access.isPremiumCaller())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "premium_required", "message", "This answer is part of Premium."));
        }
        String answer = in == null || in.answer() == null ? "" : in.answer().strip();
        if (answer.length() < 10) return ResponseEntity.badRequest().body(Map.of("error", "Write your answer first."));
        if (answer.length() > MAX_CHARS) answer = answer.substring(0, MAX_CHARS);
        AnswerCoach.Result r = AnswerCoach.coach(q.getAnswer(), answer);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", r.score());
        out.put("words", r.words());
        out.put("points", r.points());
        out.put("basis", r.basis());   // "points" or "terms": how the key points were chosen
        out.put("covered", r.covered());
        out.put("missed", r.missed());
        out.put("feedback", r.feedback());
        out.put("seconds", in.seconds() == null ? null : Math.max(0, Math.min(in.seconds(), 7200)));
        out.put("modelAnswer", q.getAnswer());   // shown after the attempt, so the member can compare
        return ResponseEntity.ok(out);
    }
}
