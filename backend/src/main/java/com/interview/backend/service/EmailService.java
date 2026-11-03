package com.interview.backend.service;

import com.interview.backend.entity.Question;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.MimeMessageHelper;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:not-set}")
    private String mailHost;

    @Value("${spring.mail.username:not-set}")
    private String mailUsername;

    @Value("${app.mail.from:noreply@interviewreader.com}")
    private String fromEmail;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.public-base-url:http://localhost:8082}")
    private String backendUrl;

    /** Where email pictures are loaded from. Mail apps cannot reach localhost, so this is always the public site (override with app.email-asset-url). */
    @Value("${app.email-asset-url:https://interviewreader.cloud}")
    private String emailAssetUrl;

    @Value("${app.jwt.secret}")
    private String signingSecret;

    @PostConstruct
    public void init() {
        log.info("Email service initialized - host: {}, username: {}", mailHost, mailUsername);
        if ("not-set".equals(mailHost) || "not-set".equals(mailUsername)) {
            log.warn("MAIL_HOST or MAIL_USERNAME not configured - emails will fail");
            return;
        }

        // Test SMTP connection
        try {
            if (mailSender instanceof JavaMailSenderImpl impl) {
                impl.testConnection();
                log.info("✓ Mail server connection successful - ready to send emails");
            } else {
                log.info("Mail sender configured (unable to test connection on startup)");
            }
        } catch (Exception e) {
            log.error("✗ Mail server connection failed: {} - Password reset emails will not work", e.toString());
        }
    }

    
    public void sendExportCodeEmail(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("Dashboard Export Unlock Code");
        message.setText("Your daily unlock code for exporting data is: " + code + "\n\n" +
            "This code is valid for 24 hours (UTC timezone).");
        mailSender.send(message);
        log.info("Export code email sent to {}", toEmail);
    }

    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("Reset your Interview Reader password");
        message.setText(
            "Hello,\n\n" +
            "You requested to reset your password for Interview Reader.\n\n" +
            "Click the link below to reset your password:\n" +
            resetLink + "\n\n" +
            "This link will expire in 1 hour.\n\n" +
            "If you didn't request this, you can safely ignore this email.\n\n" +
            "Best regards,\n" +
            "Interview Reader Team"
        );

        mailSender.send(message);
        log.info("Password reset email sent to {}", toEmail);
    }

    /** One email per user: questions added and questions edited since their last digest. */
    public void sendNewQuestionsEmail(String toEmail, String name, List<Question> added, List<Question> updated) {
        int total = added.size() + updated.size();
        String subject;
        if (added.isEmpty()) {
            subject = updated.size() == 1 ? "Updated interview question: " + updated.get(0).getTitle()
                    : updated.size() + " interview questions updated";
        } else if (updated.isEmpty()) {
            subject = added.size() == 1 ? "New interview question today: " + added.get(0).getTitle()
                    : added.size() + " new interview questions added today";
        } else {
            subject = added.size() + " new and " + updated.size() + " updated interview questions";
        }

        StringBuilder body = new StringBuilder("Hi" + (name == null || name.isBlank() ? "" : " " + name) + ",\n\n");
        int room = 25;
        if (!added.isEmpty()) {
            body.append("New questions:\n\n");
            for (Question q : added.stream().limit(room).toList()) appendQuestion(body, q, "");
            room -= Math.min(added.size(), room);
            if (added.size() > 25) body.append("…and ").append(added.size() - 25).append(" more\n\n");
        }
        if (!updated.isEmpty()) {
            body.append("Updated questions:\n\n");
            for (Question q : updated.stream().limit(Math.max(room, 0)).toList()) appendQuestion(body, q, " (updated)");
            if (updated.size() > Math.max(room, 0)) body.append("…and ").append(updated.size() - Math.max(room, 0)).append(" more\n\n");
        }
        body.append("Happy preparing!\nInterview Reader Team\n\n")
            .append("Don't want these emails? Unsubscribe: ")
            .append(backendUrl).append("/api/auth/unsubscribe?email=")
            .append(URLEncoder.encode(toEmail, StandardCharsets.UTF_8))
            .append("&sig=").append(unsubscribeSig(toEmail));

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body.toString());
        mailSender.send(message);
    }

    private void appendQuestion(StringBuilder body, Question q, String tag) {
        body.append("• [").append(q.getTech()).append("] ").append(q.getTitle()).append(tag).append("\n  ")
            .append(frontendUrl).append("/?id=").append(URLEncoder.encode(q.getId(), StandardCharsets.UTF_8))
            .append("\n\n");
    }

    /** Admin announcement: the admin's own subject and text, with the same unsubscribe footer. */
    public void sendAnnouncement(String toEmail, String subject, String body) {
        String unsubscribe = backendUrl + "/api/auth/unsubscribe?email=" + URLEncoder.encode(toEmail, StandardCharsets.UTF_8) +
                "&sig=" + unsubscribeSig(toEmail);
        String plain = body.replace(INTERVIEW_PROMO, interviewPromoPlain())
                .replace(ROADMAP_PROMO, roadmapPromoPlain())
                .replace(FEEDBACK_PROMO, feedbackPromoPlain())
                .replace(DAILY_PROMO, dailyPromoPlain())
                + "\n\n---\nDon't want these emails? Unsubscribe: " + unsubscribe;
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8"); // multipart: plain text + HTML
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plain, announcementHtml(body, unsubscribe));
            mailSender.send(mime);
        } catch (MessagingException e) {
            throw new IllegalStateException("Could not build the announcement email", e);
        }
    }

    // HTML version: paragraphs, links for web addresses, and a button for the practice page.
    private String announcementHtml(String body, String unsubscribe) {
        StringBuilder html = new StringBuilder("<div style=\"font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px\">");
        for (String paragraph : body.split("\\n\\s*\\n")) {
            String text = paragraph.strip();
            if (INTERVIEW_PROMO.equals(text)) { html.append(interviewPromoCard()); continue; }
            if (ROADMAP_PROMO.equals(text)) { html.append(roadmapPromoCard()); continue; }
            if (FEEDBACK_PROMO.equals(text)) { html.append(feedbackPromoCard()); continue; }
            if (DAILY_PROMO.equals(text)) { html.append(dailyPromoCard()); continue; }
            if (!text.isEmpty()) html.append("<p style=\"margin:0 0 14px\">").append(linkify(text)).append("</p>");
        }
        html.append("<p style=\"margin-top:24px;font-size:12px;color:#64748b\">Don't want these emails? <a href=\"")
                .append(escapeHtml(unsubscribe)).append("\">Unsubscribe</a></p></div>");
        return html.toString();
    }

    /** Put this on its own line in an announcement to get the designed "free mock interview" card in the HTML email. */
    public static final String INTERVIEW_PROMO = "[[interview-promo]]";

    private String interviewPromoPlain() {
        return "FREE mock interviews for 2 weeks\n"
                + "- Coding, system design or resume discussion, with a real interviewer.\n"
                + "- You pick the date and time. You get a Google Meet link and a shared whiteboard.\n"
                + "Book yours: " + frontendUrl + "/interview";
    }

    // Table layout with inline styles only: that is what mail apps render reliably. The pictures are hosted with the site
    // (frontend/public/promo), so they appear once that is deployed; with images blocked the alt text and the button still work.
    private String interviewPromoCard() {
        String url = escapeHtml(frontendUrl + "/interview");
        String img = escapeHtml(emailAssetUrl.replaceAll("/+$", "")) + "/promo/";
        String imgStyle = "display:block;width:100%;height:auto;border:0;font-size:18px;line-height:1.3;font-weight:bold;color:#be185d";
        return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:8px 0 22px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#ffffff\">"
                + "<tr><td style=\"padding:0;line-height:0\"><a href=\"" + url + "\"><img src=\"" + img + "mock-interview.png\" width=\"100%\" alt=\"FREE for 2 weeks: mock interviews with a real person\" style=\"" + imgStyle + "\"></a></td></tr>"
                + "<tr><td style=\"padding:0;line-height:0\"><img src=\"" + img + "interview-types.png\" width=\"100%\" alt=\"Choose your interview: coding, system design or resume discussion\" style=\"" + imgStyle + "\"></td></tr>"
                + "<tr><td style=\"padding:0;line-height:0\"><img src=\"" + img + "how-it-works.png\" width=\"100%\" alt=\"Book in 3 steps: pick a slot, get matched, join and practise\" style=\"" + imgStyle + "\"></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:22px 24px 26px;background:#ffffff\"><a href=\"" + url + "\" style=\"display:inline-block;padding:14px 32px;border-radius:10px;background:linear-gradient(90deg,#f97316,#ec4899,#7c3aed);color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px\">Book your free mock interview</a></td></tr></table>";
    }

    /** On its own line: the designed "Premium company roadmaps" card (three pictures and a button). */
    public static final String ROADMAP_PROMO = "[[roadmap-promo]]";

    private String roadmapPromoPlain() {
        return "NEW: Premium company roadmaps\n"
                + "- A week-by-week plan for Google, Amazon, Meta, Microsoft, Uber, Netflix and Atlassian.\n"
                + "- Company-tagged DSA problems, system design & LLD, and a behavioral bank mapped to each company's values.\n"
                + "- Track your progress and readiness score as you go.\n"
                + "See your roadmap: " + frontendUrl + "/roadmaps";
    }

    // Same table-and-inline-styles layout as the interview card; pictures live in frontend/public/promo.
    private String roadmapPromoCard() {
        String url = escapeHtml(frontendUrl + "/roadmaps");
        String img = escapeHtml(emailAssetUrl.replaceAll("/+$", "")) + "/promo/";
        String imgStyle = "display:block;width:100%;height:auto;border:0;font-size:18px;line-height:1.3;font-weight:bold;color:#be185d";
        return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:8px 0 22px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#ffffff\">"
                + "<tr><td style=\"padding:0;line-height:0\"><a href=\"" + url + "\"><img src=\"" + img + "roadmap-hero.png\" width=\"100%\" alt=\"New: Premium roadmaps. Your week-by-week plan to crack Google, Amazon and Meta\" style=\"" + imgStyle + "\"></a></td></tr>"
                + "<tr><td style=\"padding:0;line-height:0\"><a href=\"" + url + "\"><img src=\"" + img + "roadmap-companies.png\" width=\"100%\" alt=\"Pick your target company: Google, Amazon, Meta, Microsoft, Uber, Netflix, Atlassian\" style=\"" + imgStyle + "\"></a></td></tr>"
                + "<tr><td style=\"padding:0;line-height:0\"><img src=\"" + img + "roadmap-inside.png\" width=\"100%\" alt=\"Inside every roadmap: company-tagged DSA, system design and LLD, behavioral bank, progress tracking\" style=\"" + imgStyle + "\"></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:22px 24px 26px;background:#ffffff\"><a href=\"" + url + "\" style=\"display:inline-block;padding:14px 32px;border-radius:10px;background:linear-gradient(90deg,#f97316,#ec4899,#7c3aed);color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px\">See your company roadmap</a></td></tr></table>";
    }

    /** On its own line: the designed "Daily challenge" card (two pictures and a button). */
    public static final String DAILY_PROMO = "[[daily-promo]]";

    private String dailyPromoPlain() {
        return "NEW: the daily challenge\n- Read: one interview question from a different topic every day.\n- Solve: one coding problem, run against tests in your browser.\n"
                + "Keep your streak and earn points: " + frontendUrl + "/question-of-the-day";
    }

    // Same table-and-inline-styles layout as the other cards; pictures live in frontend/public/promo.
    private String dailyPromoCard() {
        String url = escapeHtml(frontendUrl + "/question-of-the-day");
        String img = escapeHtml(emailAssetUrl.replaceAll("/+$", "")) + "/promo/";
        String imgStyle = "display:block;width:100%;height:auto;border:0;font-size:18px;line-height:1.3;font-weight:bold;color:#c2410c";
        return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:8px 0 22px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#ffffff\">"
                + "<tr><td style=\"padding:0;line-height:0\"><a href=\"" + url + "\"><img src=\"" + img + "daily-hero.png\" width=\"100%\" alt=\"New: the daily challenge. One question to read and one coding problem to solve, every day\" style=\"" + imgStyle + "\"></a></td></tr>"
                + "<tr><td style=\"padding:0;line-height:0\"><img src=\"" + img + "daily-how.png\" width=\"100%\" alt=\"Read a question, solve a problem, keep your streak\" style=\"" + imgStyle + "\"></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:22px 24px 26px;background:#ffffff\"><a href=\"" + url + "\" style=\"display:inline-block;padding:14px 32px;border-radius:10px;background:linear-gradient(90deg,#f97316,#f59e0b);color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px\">Take today's challenge</a></td></tr></table>";
    }

    /** On its own line: a "rate us" card. Each star opens the site's feedback form with that rating already picked. */
    public static final String FEEDBACK_PROMO = "[[feedback-promo]]";

    private String feedbackUrl(int rating) {
        return frontendUrl + "/feedback?rating=" + rating;
    }

    private String feedbackPromoPlain() {
        return "How likely are you to recommend InterviewReader? Rate us from 1 to 5 here: " + frontendUrl + "/feedback";
    }

    private String feedbackPromoCard() {
        StringBuilder stars = new StringBuilder();
        for (int r = 1; r <= 5; r++) {
            stars.append("<td align=\"center\" style=\"padding:0 4px\"><a href=\"").append(escapeHtml(feedbackUrl(r)))
                    .append("\" title=\"").append(r).append(r == 1 ? " star" : " stars")
                    .append("\" style=\"display:block;width:48px;padding:10px 0;border-radius:10px;border:1px solid #fbcfe8;background:#fff7ed;color:#f59e0b;font-size:24px;line-height:1;text-decoration:none\">&#9733;</a>")
                    .append("<div style=\"margin-top:4px;font-size:12px;color:#64748b\">").append(r).append("</div></td>");
        }
        return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:8px 0 22px;border:1px solid #fbcfe8;border-radius:14px;background:linear-gradient(135deg,#fff7ed,#fdf2f8,#f5f3ff)\">"
                + "<tr><td align=\"center\" style=\"padding:24px 20px 6px\"><div style=\"font-size:20px;font-weight:bold;color:#1e293b\">How are we doing?</div>"
                + "<div style=\"margin-top:6px;font-size:14px;color:#475569\">Tap a star. It takes 10 seconds and shapes what we build next.</div></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:14px 12px 4px\"><table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\"><tr>" + stars + "</tr></table></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:14px 24px 24px\"><a href=\"" + escapeHtml(frontendUrl + "/feedback") + "\" style=\"display:inline-block;padding:12px 28px;border-radius:10px;background:linear-gradient(90deg,#f97316,#ec4899,#7c3aed);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px\">Share your feedback</a></td></tr></table>";
    }

    private static final Pattern WEB_ADDRESS = Pattern.compile("https?://[^\\s<]+");

    private String linkify(String text) {
        Matcher m = WEB_ADDRESS.matcher(escapeHtml(text));
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String url = m.group();
            String replacement = url.startsWith(frontendUrl + "/practice")
                    ? "<a href=\"" + url + "\" style=\"display:inline-block;padding:12px 22px;border-radius:10px;background:linear-gradient(90deg,#f97316,#ec4899,#7c3aed);color:#ffffff;text-decoration:none;font-weight:bold\">Open practice coding</a>"
                    : "<a href=\"" + url + "\">" + url + "</a>";
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString().replace("\n", "<br>");
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    /** Asks a member without a location to add one, so they can appear on the leaderboard. */
    public void sendLocationNudgeEmail(String toEmail, String name) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("Add your location to join the weekly leaderboard");
        message.setText("Hi" + (name == null || name.isBlank() ? "" : " " + name) + ",\n\n" +
                "Members who add their country and city appear on the weekly leaderboard, " +
                "and earn a league as they read.\n\n" +
                "Add your location here (takes 10 seconds):\n" +
                frontendUrl + "/profile\n\n" +
                "Happy preparing!\nInterview Reader Team\n\n" +
                "Don't want these emails? Unsubscribe: " + backendUrl + "/api/auth/unsubscribe?email=" +
                URLEncoder.encode(toEmail, StandardCharsets.UTF_8) + "&sig=" + unsubscribeSig(toEmail));
        mailSender.send(message);
    }

    /** "Your N-day streak ends tonight": one tap to keep it, with today's challenge picture. */
    public void sendStreakNudgeEmail(String toEmail, String name, int streak, String questionTitle, String questionUrl, String problemTitle) {
        String plain = "You're on a " + streak + "-day streak. Open Interview Reader once today to keep it, and earn your daily 25 points.\n\n"
                + "Today's challenge:\n  Read: " + questionTitle + "\n" + (problemTitle == null ? "" : "  Solve: " + problemTitle + "\n") + "  " + questionUrl + "\n\n"
                + "Keep going!\nInterview Reader Team";
        String intro = "You're on a <b>" + streak + "-day streak</b>. Open Interview Reader once today to keep it, and earn your daily 25 points.</p><p style=\"margin:0 0 14px\">📖 <b>Read:</b> "
                + escapeHtml(questionTitle) + (problemTitle == null ? "" : "<br>💻 <b>Solve:</b> " + escapeHtml(problemTitle));
        sendHeroMail(toEmail, name, "🔥 Your " + streak + "-day streak ends tonight", plain, intro, questionUrl);
    }

    /** The midday reminder: today's question and problem are waiting, with the daily challenge picture and a button. */
    public void sendChallengeReminderEmail(String toEmail, String name, String questionTitle, String problemTitle, String url) {
        String plain = "Today's challenge takes a few minutes:\n  Read: " + questionTitle + "\n" + (problemTitle == null ? "" : "  Solve: " + problemTitle + "\n")
                + "\nSubmit your solution and finish the read to keep your streak and earn points:\n" + url + "\n\nSee you there!\nInterview Reader Team";
        String intro = "Today's challenge takes a few minutes:</p><p style=\"margin:0 0 14px\">📖 <b>Read:</b> " + escapeHtml(questionTitle)
                + (problemTitle == null ? "" : "<br>💻 <b>Solve:</b> " + escapeHtml(problemTitle));
        sendHeroMail(toEmail, name, "⏰ Today's challenge is waiting: " + questionTitle, plain, intro, url);
    }

    /**
     * A friendly mail built around the daily challenge picture (the same banner as the site): greeting, a few lines, the banner as a
     * link, a button and the unsubscribe footer. {@code introHtml} is already escaped HTML that fits inside a paragraph.
     */
    private void sendHeroMail(String toEmail, String name, String subject, String plainBody, String introHtml, String url) {
        String hi = "Hi" + (name == null || name.isBlank() ? "" : " " + name) + ",";
        String unsubscribe = backendUrl + "/api/auth/unsubscribe?email=" + URLEncoder.encode(toEmail, StandardCharsets.UTF_8) + "&sig=" + unsubscribeSig(toEmail);
        String img = escapeHtml(emailAssetUrl.replaceAll("/+$", "")) + "/promo/daily-hero.png";
        String html = "<div style=\"font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px\">"
                + "<p style=\"margin:0 0 14px\">" + escapeHtml(hi) + "</p>"
                + "<p style=\"margin:0 0 14px\">" + introHtml + "</p>"
                + "<a href=\"" + escapeHtml(url) + "\"><img src=\"" + img + "\" width=\"100%\" alt=\"Today's challenge: one question to read, one problem to solve\" style=\"display:block;width:100%;height:auto;border:0;border-radius:14px;font-weight:bold;color:#c2410c\"></a>"
                + "<p style=\"margin:18px 0\" align=\"center\"><a href=\"" + escapeHtml(url) + "\" style=\"display:inline-block;padding:14px 32px;border-radius:10px;background:linear-gradient(90deg,#f97316,#f59e0b);color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px\">Take today's challenge</a></p>"
                + "<p style=\"margin-top:24px;font-size:12px;color:#64748b\">Don't want these emails? <a href=\"" + escapeHtml(unsubscribe) + "\">Unsubscribe</a></p></div>";
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(hi + "\n\n" + plainBody + "\n\n---\nDon't want these emails? Unsubscribe: " + unsubscribe, html);
            mailSender.send(mime);
        } catch (MessagingException e) {
            throw new IllegalStateException("Could not build the email", e);
        }
    }

    /** HMAC of the email so the unsubscribe link can't be forged for someone else. */
    String unsubscribeSig(String email) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(("unsubscribe:" + email.toLowerCase()).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public boolean isValidUnsubscribe(String email, String sig) {
        return sig != null && MessageDigest.isEqual(
                unsubscribeSig(email).getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8));
    }
}
