package com.interview.backend.controller;

import com.interview.backend.entity.DigestRun;
import com.interview.backend.repository.DigestRunRepository;
import com.interview.backend.repository.EmailLogRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Admin email centre: who got which mail, who didn't, a log of attempts, and a sender. ROLE_ADMIN only. */
@RestController
@RequestMapping("/admin/emails")
@RequiredArgsConstructor
public class AdminEmailController {

    private final EmailLogRepository logs;
    private final AnnouncementService announcements;
    private final DigestRunRepository digestRuns;
    private final QuestionRepository questions;
    private final UserRepository users;
    private final com.interview.backend.service.ChallengeReminderNotifier challengeReminder;

    @Value("${app.digest.time:19:00}")
    private LocalTime sendAt;

    @Value("${app.digest.zone:Asia/Kolkata}")
    private ZoneId zone;

    /**
     * What the next digest will send: the new questions waiting, who will get it, and when.
     * The same window and recipient rules the digest job uses.
     */
    @GetMapping("/digest")
    public Map<String, Object> digest() {
        ZonedDateTime nowZ = ZonedDateTime.now(zone);
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        LocalDateTime from = digestRuns.findTopByStatusOrderByCoveredToDesc("DONE")
                .map(DigestRun::getCoveredTo).orElse(now.minusDays(1));

        ZonedDateTime todaysSend = nowZ.toLocalDate().atTime(sendAt).atZone(zone);
        ZonedDateTime nextSend = nowZ.isBefore(todaysSend) ? todaysSend : todaysSend.plusDays(1);

        Optional<DigestRun> today = digestRuns.findByRunDate(nowZ.toLocalDate());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("nextSendAt", nextSend.toInstant());
        out.put("todayStatus", today.map(DigestRun::getStatus).orElse("NOT_STARTED"));
        int added = questions.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByTechAscSortKeyAsc(from, now).size();
        int updatedCount = questions.findByUpdatedAtGreaterThanEqualAndUpdatedAtLessThanAndCreatedAtLessThanOrderByTechAscSortKeyAsc(from, now, from).size();
        out.put("pendingQuestions", added + updatedCount);
        out.put("pendingSince", from.atZone(zone).toInstant());
        out.put("recipients", users.findDigestRecipients(now).size());
        out.put("runs", digestRuns.findTop10ByOrderByIdDesc().stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", r.getRunDate().toString());
            m.put("status", r.getStatus());
            m.put("questions", r.getQuestionCount());
            m.put("sent", r.getSentCount());
            m.put("finishedAt", r.getFinishedAt());
            return m;
        }).toList());
        return out;
    }

    /** Today's daily challenge reminder: how many were sent, how many failed, how many are still waiting. */
    @GetMapping("/challenge-reminder")
    public Map<String, Object> challengeReminder() { return challengeReminder.status(); }

    /** Resend today's challenge reminder to members it failed for, and to anyone eligible who was missed. Runs in the background. */
    @PostMapping("/challenge-reminder/retry")
    public Map<String, Object> retryChallengeReminder() {
        int freed = challengeReminder.retryToday();
        Map<String, Object> out = new LinkedHashMap<>(challengeReminder.status());
        out.put("retried", freed);
        return out;
    }

    @GetMapping("/log")
    public List<Map<String, Object>> log() {
        return logs.findTop200ByOrderByCreatedAtDesc().stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("when", l.getCreatedAt());
            m.put("email", l.getEmail());
            m.put("type", l.getType());
            m.put("subject", l.getSubject());
            m.put("status", l.getStatus());
            m.put("error", l.getError());
            return m;
        }).collect(Collectors.toList());
    }

    /**
     * Every member with what they received. "received" means their last digest was sent;
     * "status" is one of: Got digest, Not received, Opted out.
     */
    @GetMapping("/recipients")
    public List<Map<String, Object>> recipients() {
        return logs.recipientStatus().stream().map(r -> {
            boolean optedOut = Boolean.TRUE.equals(r[5]);
            Instant lastDigest = toInstant(r[6]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", ((Number) r[0]).longValue());
            m.put("email", r[1]);
            m.put("name", r[2] == null ? "" : r[2]);
            m.put("location", (r[4] == null ? "" : r[4] + "") + (r[3] == null ? "" : (r[4] == null ? "" : ", ") + r[3]));
            m.put("optedOut", optedOut);
            m.put("lastDigest", lastDigest);
            m.put("lastNudge", toInstant(r[7]));
            m.put("lastStatus", r[8]);
            m.put("status", optedOut ? "Opted out" : lastDigest != null ? "Got digest" : "Not received");
            return m;
        }).collect(Collectors.toList());
    }

    public record SendRequest(String subject, String body, String audience) {}

    /** Queues an announcement to the chosen audience. Returns how many members it will reach. */
    @PostMapping("/send")
    public ResponseEntity<?> send(@RequestBody SendRequest req) {
        String subject = req.subject() == null ? "" : req.subject().trim();
        String body = req.body() == null ? "" : req.body().trim();
        if (subject.isEmpty() || subject.length() > 200) return ResponseEntity.badRequest().body(Map.of("error", "Subject is required (max 200 characters)"));
        if (body.isEmpty() || body.length() > 10_000) return ResponseEntity.badRequest().body(Map.of("error", "Message is required (max 10,000 characters)"));
        String audience = AnnouncementService.NO_LOCATION.equals(req.audience()) ? AnnouncementService.NO_LOCATION : AnnouncementService.ALL;
        int reach = announcements.audience(audience).size();
        announcements.send(subject, body, audience);
        return ResponseEntity.accepted().body(Map.of("queued", reach, "audience", audience));
    }

    private static Instant toInstant(Object o) {
        if (o == null) return null;
        if (o instanceof java.sql.Timestamp t) return t.toInstant();
        if (o instanceof java.time.OffsetDateTime d) return d.toInstant();
        return Instant.parse(String.valueOf(o));
    }
}
