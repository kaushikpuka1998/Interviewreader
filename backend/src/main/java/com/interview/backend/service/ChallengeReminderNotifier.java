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
 * Every day at midday (12:00 India time by default) reminds recently active members to finish today's challenge: read the
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

    int sendReminders(LocalDate today) {
        Map<String, Object> q = daily.today();
        if (q.isEmpty()) return 0;
        String title = (String) q.get("title");
        Map<?, ?> prob = q.get("problem") instanceof Map<?, ?> p ? p : null;
        String url = site.replaceAll("/+$", "") + "/question-of-the-day";
        int sent = 0;
        var candidates = users.findChallengeReminderCandidates(today.minusDays(14), today.minusDays(1), today, (String) q.get("id"),
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
