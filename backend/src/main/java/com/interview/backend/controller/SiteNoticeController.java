package com.interview.backend.controller;

import com.interview.backend.entity.SiteNotice;
import com.interview.backend.repository.SiteNoticeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

/** Text paired with the site_notice feature flag. The flag decides visibility; this controller stores the explanation. */
@RestController
public class SiteNoticeController {

    private final SiteNoticeRepository notices;

    public SiteNoticeController(SiteNoticeRepository notices) {
        this.notices = notices;
    }

    @GetMapping("/site-notice")
    public ResponseEntity<Map<String, String>> publicNotice() {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofSeconds(60)).cachePublic())
                .body(Map.of("message", message()));
    }

    @GetMapping("/admin/site-notice")
    public Map<String, String> adminNotice() {
        return Map.of("message", message());
    }

    @PutMapping("/admin/site-notice")
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        Object raw = body.get("message");
        if (!(raw instanceof String value)) return ResponseEntity.badRequest().body(Map.of("error", "message must be text"));
        String message = value.trim();
        if (message.length() > 400) return ResponseEntity.badRequest().body(Map.of("error", "Message must be 400 characters or fewer."));

        SiteNotice notice = notices.findById(1L).orElseGet(SiteNotice::new);
        notice.setId(1L);
        notice.setMessage(message);
        notice.setUpdatedAt(Instant.now());
        notices.save(notice);
        return ResponseEntity.ok(Map.of("message", message));
    }

    private String message() {
        return notices.findById(1L).map(SiteNotice::getMessage).filter(s -> !s.isBlank()).orElse("");
    }
}
