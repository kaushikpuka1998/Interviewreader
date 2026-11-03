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
 * Every evening (18:00 India time by default) emails members whose streak is alive but who haven't checked in
 * today: "Your N-day streak ends tonight", with the question of the day. Members who opted out of emails are
 * skipped, and the claim happens before the send, so a retry or a second instance can't email anyone twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StreakNudgeNotifier {

    private static final String SUBJECT = "Your streak ends tonight";

    private final UserRepository users;
    private final EmailService email;
    private final EmailLogRepository emailLogs;
    private final DailyQuestionService daily;

    @Value("${app.streak-nudge.hour:18}")
    private int hour;
    @Value("${app.streak-nudge.enabled:true}")
    private boolean enabled;
    @Value("${app.frontend.url:http://localhost:5173}")
    private String site;

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Scheduled(fixedDelayString = "PT30M", initialDelayString = "PT3M")
    public void tick() {
        if (enabled && ZonedDateTime.now(ZONE).getHour() == hour) sendNudges(LocalDate.now(ZONE));
    }

    int sendNudges(LocalDate today) {
        Map<String, Object> q = daily.today();
        String title = q.isEmpty() ? "Pick up where you left off" : (String) q.get("title");
        String url = site.replaceAll("/+$", "") + (q.isEmpty() ? "/questions" : "/question-of-the-day");
        String problem = q.get("problem") instanceof Map<?, ?> p ? (String) p.get("title") : null;
        int sent = 0;
        for (User u : users.findStreakNudgeCandidates(today.minusDays(1), today)) {
            if (users.claimStreakNudge(u.getId(), today) == 0) continue;
            try {
                email.sendStreakNudgeEmail(u.getEmail(), u.getName(), u.getStreakCount(), title, url, problem);
                sent++;
                emailLogs.save(EmailLog.of(u, "NUDGE", SUBJECT, null));
            } catch (Exception e) {
                log.warn("Streak nudge to {} failed: {}", u.getEmail(), e.toString());
                emailLogs.save(EmailLog.of(u, "NUDGE", SUBJECT, e));
            }
        }
        log.info("Streak nudge: {} email(s) sent", sent);
        return sent;
    }
}
