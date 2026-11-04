package com.interview.backend.controller;

import com.interview.backend.service.LandingService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

/** Public: the content of a keyword landing page (see LandingService). */
@RestController
public class LandingController {

    private final LandingService landing;

    public LandingController(LandingService landing) { this.landing = landing; }

    @GetMapping("/public/landing")
    public ResponseEntity<?> page(@RequestParam String path) {
        Map<String, Object> page = landing.build(path);
        if (page == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic()).body(page);
    }

    @GetMapping("/public/landing/paths")
    public ResponseEntity<?> paths() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic()).body(landing.paths());
    }
}
