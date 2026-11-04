package com.interview.backend.controller;

import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.SkillGapService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in member's skill gap analysis (weak topics and what to learn next). */
@RestController
public class SkillGapController {

    private final SkillGapService skills;
    private final UserRepository users;

    public SkillGapController(SkillGapService skills, UserRepository users) {
        this.skills = skills;
        this.users = users;
    }

    @GetMapping("/me/skills")
    public ResponseEntity<?> mine(Authentication auth) {
        return users.findByEmail(auth.getName()).<ResponseEntity<?>>map(u -> ResponseEntity.ok(skills.analyse(u)))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }
}
