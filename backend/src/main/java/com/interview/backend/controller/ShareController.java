package com.interview.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.CodeSubmissionRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import com.interview.backend.service.PointsService;
import com.interview.backend.service.ShareCardService;
import com.interview.backend.service.ShareCardService.Stat;
import com.interview.backend.service.UsernameService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Share links for LinkedIn (and any site that builds a preview card). Link crawlers don't run JavaScript, so the
 * app's per-page titles never reach them; these pages carry their own title, description and a generated preview
 * picture (question card, roadmap card or progress certificate) in plain meta tags, then send people straight on
 * to the real page. Public (anyRequest permitAll); the certificate only shows numbers the public profile shows.
 *
 * Links and pictures use the site's own address (site + "/share/..."): Caddy forwards /share/* to /api/share/*
 * (see the Caddyfile), so the API's address never shows in a shared post.
 */
@RestController
public class ShareController {

    private static final String UTM = "utm_source=linkedin&utm_medium=share";

    private final QuestionRepository questions;
    private final UserProgressRepository progress;
    private final CodeSubmissionRepository submissions;
    private final UsernameService usernames;
    private final PointsService points;
    private final ShareCardService cards;
    private final String site;
    private final JsonNode roadmaps;

    public ShareController(QuestionRepository questions, UserProgressRepository progress, CodeSubmissionRepository submissions,
                           UsernameService usernames, PointsService points, ShareCardService cards, ObjectMapper mapper,
                           @Value("${app.frontend.url:https://interviewreader.cloud}") String site) throws Exception {
        this.questions = questions;
        this.progress = progress;
        this.submissions = submissions;
        this.usernames = usernames;
        this.points = points;
        this.cards = cards;
        this.site = site.replaceAll("/+$", "");
        try (InputStream in = new ClassPathResource("roadmaps.json").getInputStream()) {
            this.roadmaps = mapper.readTree(in);
        }
    }

    // ---------- questions ----------

    @GetMapping(value = "/share/q/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> question(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null) return page("Interview Reader", "Interview questions with real answers.", site + "/", site + "/", site + "/og-card.png");
        String url = site + "/" + slug(q.getTitle()) + "?id=" + q.getId();
        return page(q.getTitle(), topic(q) + " interview question with a detailed answer, code examples and diagrams on Interview Reader.",
                url, url + "&" + UTM, site + "/share/q/" + q.getId() + "/card.png");
    }

    @GetMapping(value = "/share/q/{id}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> questionCard(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null) return ResponseEntity.notFound().build();
        return png(cards.question(q.getTitle(), topic(q), q.getDifficulty()));
    }

    // ---------- company roadmaps ----------

    @GetMapping(value = "/share/roadmap/{company}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> roadmap(@PathVariable String company) {
        JsonNode c = company(company);
        String url = site + "/roadmaps" + (c == null ? "" : "?company=" + c.path("id").asText());
        if (c == null) return page("Company Interview Roadmaps", "Round-by-round interview roadmaps for top tech companies.", url, url, site + "/og-card.png");
        String name = c.path("name").asText();
        return page(name + " Interview Roadmap: DSA, System Design & Behavioral",
                name + " interview roadmap: " + c.path("rounds").size() + " rounds explained. Focus: " + c.path("tagline").asText() + ".",
                url, url + "&" + UTM, site + "/share/roadmap/" + c.path("id").asText() + "/card.png");
    }

    @GetMapping(value = "/share/roadmap/{company}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> roadmapCard(@PathVariable String company) {
        JsonNode c = company(company);
        if (c == null) return ResponseEntity.notFound().build();
        List<String> rounds = new ArrayList<>();
        c.path("rounds").forEach(r -> rounds.add(r.path("name").asText()));
        return png(cards.roadmap(c.path("name").asText(), c.path("tagline").asText(), rounds));
    }

    // ---------- member progress certificate ----------

    @GetMapping(value = "/share/u/{username}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> progress(@PathVariable String username) {
        User u = usernames.resolve(username.toLowerCase()).orElse(null);
        String url = site + (u == null ? "/" : "/u/" + u.getUsername());
        if (u == null) return page("Interview Reader", "Interview questions with real answers.", url, url, site + "/og-card.png");
        List<Stat> stats = stats(u);
        String name = displayName(u);
        // The stats in the image URL make LinkedIn fetch a fresh certificate whenever the numbers change.
        String version = Integer.toHexString(stats.hashCode());
        return page(name + "'s interview prep progress",
                name + " has read " + stats.get(0).value() + " questions and solved " + stats.get(1).value() + " coding problems on Interview Reader.",
                url, url + "?" + UTM, site + "/share/u/" + u.getUsername() + "/card.png?v=" + version);
    }

    @GetMapping(value = "/share/u/{username}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> progressCard(@PathVariable String username) {
        User u = usernames.resolve(username.toLowerCase()).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        String issued = LocalDate.now(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH));
        String host = site.replaceFirst("^https?://", "");
        return png(cards.certificate(displayName(u), stats(u), issued, host + "/u/" + u.getUsername()));
    }

    /**
     * A small streak badge for a README or resume: ![streak](https://interviewreader.cloud/share/u/<name>/streak.svg).
     * Shows the live streak, so it stays current wherever it is embedded.
     */
    @GetMapping(value = "/share/u/{username}/streak.svg", produces = "image/svg+xml")
    public ResponseEntity<String> streakBadge(@PathVariable String username) {
        User u = usernames.resolve(username.toLowerCase()).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        Map<String, Object> p = points.summary(u);
        int streak = ((Number) p.get("streak")).intValue(), best = ((Number) p.get("best")).intValue();
        String main = streak + (streak == 1 ? "-day streak" : "-day streak");
        String sub = best > streak ? "best " + best + " days" : "interviewreader.cloud";
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="232" height="64" viewBox="0 0 232 64" role="img" aria-label="%1$s on Interview Reader">
                <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1512"/><stop offset="1" stop-color="#06352a"/></linearGradient>
                <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>
                <rect width="232" height="64" rx="14" fill="url(#g)"/><rect x="0.5" y="0.5" width="231" height="63" rx="13.5" fill="none" stroke="#34d399" stroke-opacity=".5"/>
                <path d="M32 12c2 7-4 10-4 15 0 3 2 5 5 5 3 0 5-2 5-5 4 3 6 7 6 11a12 12 0 0 1-24 0c0-9 12-13 12-26z" fill="url(#f)" transform="translate(-4 4) scale(1.05)"/>
                <text x="62" y="31" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">%1$s</text>
                <text x="62" y="49" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="#6ee7b7">%2$s</text>
                </svg>
                """.formatted(main, sub);
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").body(svg);
    }

    private List<Stat> stats(User u) {
        long read = progress.findByUserId(u.getId()).stream().filter(UserProgress::isRead).count();
        long solved = submissions.findByUserEmailAndStatus(u.getEmail(), "Accepted").stream()
                .map(s -> s.getProblemId()).distinct().count();
        Map<String, Object> p = points.summary(u);
        int best = ((Number) p.get("best")).intValue();
        long total = ((Number) p.get("totalPoints")).longValue();
        return List.of(new Stat(String.format("%,d", read), "Questions read"),
                new Stat(String.format("%,d", solved), "Coding solved"),
                new Stat(best + (best == 1 ? " day" : " days"), "Best streak"),
                new Stat(String.format("%,d", total), "Points earned"));
    }

    // ---------- helpers ----------

    private ResponseEntity<String> page(String title, String description, String url, String target, String image) {
        String t = HtmlUtils.htmlEscape(title), d = HtmlUtils.htmlEscape(description), u = HtmlUtils.htmlEscape(url),
                r = HtmlUtils.htmlEscape(target), i = HtmlUtils.htmlEscape(image);
        String html = """
                <!doctype html><html lang="en"><head><meta charset="utf-8">
                <title>%6$s</title>
                <meta name="description" content="%2$s">
                <link rel="canonical" href="%3$s">
                <meta property="og:type" content="article"><meta property="og:site_name" content="Interview Reader">
                <meta property="og:title" content="%1$s"><meta property="og:description" content="%2$s">
                <meta property="og:url" content="%3$s"><meta property="og:image" content="%4$s">
                <meta property="og:image:width" content="1200"><meta property="og:image:height" content="627">
                <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%1$s">
                <meta name="twitter:description" content="%2$s"><meta name="twitter:image" content="%4$s">
                <meta http-equiv="refresh" content="0;url=%5$s">
                </head><body><p><a href="%5$s">%1$s</a></p></body></html>
                """.formatted(t, d, u, i, r, t.equals("Interview Reader") ? t : t + " | Interview Reader");
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").body(html);
    }

    private static ResponseEntity<byte[]> png(byte[] bytes) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("Cache-Control", "public, max-age=86400").body(bytes);
    }

    private JsonNode company(String id) {
        for (JsonNode c : roadmaps.path("companies")) if (c.path("id").asText().equalsIgnoreCase(id)) return c;
        return null;
    }

    private static String displayName(User u) {
        return u.getName() == null || u.getName().isBlank() ? u.getUsername() : u.getName().trim();
    }

    // Same slug rule as the frontend (lib/slug.js), so the link lands on the question's own URL.
    static String slug(String title) {
        String s = String.valueOf(title == null ? "" : title).toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return s.length() > 80 ? s.substring(0, 80) : s;
    }

    private static String topic(Question q) {
        if (q.getCategory() != null && !q.getCategory().isBlank()) return q.getCategory();
        String t = q.getTech();
        if (t == null || t.isBlank()) return "Tech";
        return switch (t) {
            case "hld" -> "System design";
            case "sql" -> "SQL";
            case "golang" -> "Go";
            case "node" -> "Node.js";
            default -> Character.toUpperCase(t.charAt(0)) + t.substring(1);
        };
    }
}
