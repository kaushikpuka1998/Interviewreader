package com.interview.backend.service;

import com.interview.backend.entity.EmailLog;
import com.interview.backend.entity.User;
import com.interview.backend.repository.EmailLogRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

/** Admin-composed emails. The send runs in the background; every attempt is logged. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnnouncementService {

    public static final String ALL = "all";
    public static final String NO_LOCATION = "no-location";

    private final UserRepository users;
    private final EmailService email;
    private final EmailLogRepository emailLogs;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    /** Fills {{name}} and {{profile_link}} for one member. Unknown placeholders are left as typed. */
    public String render(String text, User u) {
        String name = u.getName() == null || u.getName().isBlank() ? "there" : u.getName().trim();
        return text.replace("{{name}}", name)
                .replace("{{profile_link}}", frontendUrl + "/profile")
                .replace("{{resume_link}}", frontendUrl + "/resume")
                .replace("{{practice_link}}", frontendUrl + "/practice")
                .replace("{{interview_link}}", frontendUrl + "/interview")
                .replace("{{roadmap_link}}", frontendUrl + "/roadmaps")
                .replace("{{daily_link}}", frontendUrl + "/question-of-the-day")
                .replace("{{feedback_link}}", frontendUrl + "/feedback");
    }

    public List<User> audience(String audience) {
        return NO_LOCATION.equals(audience) ? users.findSubscribedWithoutLocation() : users.findSubscribed();
    }

    // ponytail: one SMTP send per member, sequential. Fine for hundreds; past the provider cap move to a bulk-mail API.
    @Async
    public void send(String subject, String body, String audience) {
        List<User> recipients = audience(audience);
        int sent = 0;
        for (User u : recipients) {
            String personalSubject = render(subject, u);
            try {
                email.sendAnnouncement(u.getEmail(), personalSubject, render(body, u));
                sent++;
                emailLogs.save(EmailLog.of(u, "ANNOUNCEMENT", personalSubject, null));
            } catch (Exception e) {
                log.warn("Announcement to {} failed: {}", u.getEmail(), e.toString());
                emailLogs.save(EmailLog.of(u, "ANNOUNCEMENT", personalSubject, e));
            }
        }
        log.info("Announcement '{}': {}/{} sent", subject, sent, recipients.size());
    }
}
