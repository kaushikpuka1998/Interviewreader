package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.TrackService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Role-wise tracks. Public to read; a signed-in member also gets their own progress through each step. */
@RestController
public class TrackController {

    private final TrackService tracks;
    private final UserRepository users;

    public TrackController(TrackService tracks, UserRepository users) {
        this.tracks = tracks;
        this.users = users;
    }

    @GetMapping("/public/tracks")
    public Object list() { return tracks.list(); }

    @GetMapping("/public/tracks/{id}")
    public ResponseEntity<?> one(@PathVariable String id) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        User u = a != null && a.isAuthenticated() && !"anonymousUser".equals(a.getName()) ? users.findByEmail(a.getName()).orElse(null) : null;
        Map<String, Object> t = tracks.build(id, u);
        return t == null ? ResponseEntity.notFound().build() : ResponseEntity.ok().header("Cache-Control", "private, no-cache").body(t);
    }
}
