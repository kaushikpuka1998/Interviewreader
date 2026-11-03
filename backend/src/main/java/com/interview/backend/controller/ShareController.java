package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * Share links for LinkedIn (and any site that builds a preview card). Link crawlers don't run JavaScript, so the
 * app's per-page titles never reach them; this page carries the question's own title, description and preview
 * image in plain meta tags, then sends people straight on to the question. Public (anyRequest permitAll).
 */
@RestController
public class ShareController {

    private final QuestionRepository questions;

    private final String site;

    public ShareController(QuestionRepository questions, @Value("${app.frontend.url:https://interviewreader.cloud}") String site) {
        this.questions = questions;
        this.site = site.replaceAll("/+$", "");
    }

    @GetMapping(value = "/share/q/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> question(@PathVariable String id) {
        Question q = questions.findById(id).orElse(null);
        if (q == null) return page("Interview Reader", "Interview questions with real answers.", site + "/", site + "/");
        String url = site + "/" + slug(q.getTitle()) + "?id=" + q.getId();
        String target = url + "&utm_source=linkedin&utm_medium=share";   // tagged so these visits show in the funnel
        String topic = q.getCategory() == null || q.getCategory().isBlank() ? tech(q.getTech()) : q.getCategory();
        return page(q.getTitle(), topic + " interview question with a detailed answer, code examples and diagrams on Interview Reader.", url, target);
    }

    private ResponseEntity<String> page(String title, String description, String url, String target) {
        String t = HtmlUtils.htmlEscape(title), d = HtmlUtils.htmlEscape(description), u = HtmlUtils.htmlEscape(url), r = HtmlUtils.htmlEscape(target);
        String image = HtmlUtils.htmlEscape(site + "/og-card.png");
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
                """.formatted(t, d, u, image, r, t.equals("Interview Reader") ? t : t + " | Interview Reader");
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").body(html);
    }

    // Same slug rule as the frontend (lib/slug.js), so the link lands on the question's own URL.
    static String slug(String title) {
        String s = String.valueOf(title == null ? "" : title).toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return s.length() > 80 ? s.substring(0, 80) : s;
    }

    private static String tech(String t) {
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
