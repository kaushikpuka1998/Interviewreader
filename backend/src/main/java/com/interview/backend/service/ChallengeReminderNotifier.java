package com.interview.backend.service;

import com.interview.backend.entity.EmailLog;
import com.interview.backend.entity.User;
import com.interview.backend.repository.EmailLogRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;

/**
 * Every day (09:00 India time by default) reminds every member who has not unsubscribed to finish today's challenge: read the
 * question and submit the coding problem. Members who already did both, who opted out, or whose streak ends tonight (the
 * evening streak email covers them) are skipped. The claim happens before the send, so a retry or a second instance can't
 * email anyone twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChallengeReminderNotifier {

    private static final String SUBJECT = "Today's challenge is waiting";
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final UserRepository users;
    private final EmailService email;
    private final EmailLogRepository emailLogs;
    private final DailyQuestionService daily;

    @Value("${app.challenge-reminder.hour:9}")
    private int hour;
    @Value("${app.challenge-reminder.enabled:true}")
    private boolean enabled;
    @Value("${app.frontend.url:http://localhost:5173}")
    private String site;

    @Scheduled(fixedDelayString = "PT30M", initialDelayString = "PT4M")
    public void tick() {
        if (enabled && ZonedDateTime.now(ZONE).getHour() == hour) sendReminders(LocalDate.now(ZONE));
    }

    private final java.util.concurrent.atomic.AtomicBoolean running = new java.util.concurrent.atomic.AtomicBoolean();

    /** What the admin screen shows: how many failed today, how many are still waiting, how many were sent, and the schedule. */
    public Map<String, Object> status() {
        LocalDate today = LocalDate.now(ZONE);
        var dayStart = today.atStartOfDay(ZONE).toInstant();
        Map<String, Object> q = daily.today();
        Map<?, ?> prob = q.get("problem") instanceof Map<?, ?> p ? p : null;
        long failed = emailLogs.countFailedChallengeReminders(SUBJECT, dayStart);
        long sentToday = emailLogs.countSentChallengeReminders(SUBJECT, dayStart);
        int waiting = q.isEmpty() ? 0 : users.findChallengeReminderCandidates(today.minusDays(1), today, (String) q.get("id"),
                prob == null ? null : ((Number) prob.get("id")).longValue(), dayStart).size();
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("enabled", enabled);
        out.put("hour", hour);
        out.put("sentToday", sentToday);
        out.put("failedToday", failed);
        out.put("waiting", waiting);   // eligible and not yet mailed today (includes the failed ones once freed)
        out.put("running", running.get());
        return out;
    }

    /**
     * Admin "retry": frees today's claim for members whose mail failed, then sends to everyone still eligible and not yet mailed today
     * (the failed ones, and anyone missed because the app was down at send time). Runs in the background; returns how many were freed.
     */
    public int retryToday() {
        LocalDate today = LocalDate.now(ZONE);
        int freed = users.freeFailedChallengeReminders(today, SUBJECT, today.atStartOfDay(ZONE).toInstant());
        if (running.compareAndSet(false, true)) {
            // Its own thread, created here so it inherits the app's class loader. The shared ForkJoin pool does not have it, and Jakarta Mail
            // then cannot find its provider ("No provider of jakarta.mail.util.StreamProvider was found") when running from the packaged jar.
            Thread t = new Thread(() -> {
                try { sendReminders(today); } catch (Exception e) { log.warn("Challenge reminder retry failed: {}", e.toString()); }
                finally { running.set(false); }
            }, "challenge-reminder-retry");
            t.setDaemon(true);
            t.start();
        }
        return freed;
    }

    int sendReminders(LocalDate today) {
        Map<String, Object> q = daily.today();
        if (q.isEmpty()) return 0;
        String title = (String) q.get("title");
        Map<?, ?> prob = q.get("problem") instanceof Map<?, ?> p ? p : null;
        String url = site.replaceAll("/+$", "") + "/question-of-the-day";
        int sent = 0;
        var candidates = users.findChallengeReminderCandidates(today.minusDays(1), today, (String) q.get("id"),
                prob == null ? null : ((Number) prob.get("id")).longValue(), today.atStartOfDay(ZONE).toInstant());
        for (User u : candidates) {
            if (users.claimChallengeReminder(u.getId(), today) == 0) continue;
            try {
                email.sendChallengeReminderEmail(u.getEmail(), u.getName(), title, prob == null ? null : (String) prob.get("title"), url);
                sent++;
                emailLogs.save(EmailLog.of(u, "NUDGE", SUBJECT, null));
            } catch (Exception e) {
                log.warn("Challenge reminder to {} failed: {}", u.getEmail(), e.toString());
                emailLogs.save(EmailLog.of(u, "NUDGE", SUBJECT, e));
            }
        }
        log.info("Challenge reminder: {} email(s) sent", sent);
        return sent;
    }
}
