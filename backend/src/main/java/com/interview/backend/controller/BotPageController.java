package com.interview.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.service.AccessService;
import com.interview.backend.service.LandingService;
import com.interview.backend.service.ShareSlug;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * Plain-HTML versions of the public pages for AI and search assistants (GPTBot, ClaudeBot, PerplexityBot, ...). Those crawlers mostly do not
 * run JavaScript, and the app is a JavaScript app, so Caddy sends them here instead. A question shows its answer only when an anonymous
 * visitor could read it (a free topic, or the free preview of a Premium topic); everything else shows the question and a pointer to sign up.
 */
@RestController
public class BotPageController {

    private record Index(Map<String, String> slugToId, Map<String, Integer> perTech, long at) {}

    private final QuestionRepository questions;
    private final AccessService access;
    private final LandingService landing;
    private final ObjectMapper mapper;
    private final String site;
    private volatile Index index;

    public BotPageController(QuestionRepository questions, AccessService access, LandingService landing, ObjectMapper mapper,
                             @Value("${app.frontend.url:https://interviewreader.cloud}") String site) {
        this.questions = questions;
        this.access = access;
        this.landing = landing;
        this.mapper = mapper;
        this.site = site.replaceAll("/+$", "");
    }

    private Index index() {
        Index i = index;
        if (i != null && System.currentTimeMillis() - i.at() < 600_000) return i;
        Map<String, String> slugs = new HashMap<>();
        Map<String, Integer> perTech = new TreeMap<>();
        for (Object[] r : questions.idTitlesTechs()) {
            slugs.putIfAbsent(ShareSlug.of((String) r[1]), (String) r[0]);
            perTech.merge((String) r[2], 1, Integer::sum);
        }
        return index = new Index(slugs, perTech, System.currentTimeMillis());
    }

    @GetMapping(value = "/share/bot/{*path}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> page(@PathVariable String path, @RequestParam(required = false) String id) {
        String p = path.length() > 1 ? path.replaceAll("/+$", "") : "/";
        if ("/".equals(p)) return ok(home());
        if (landing.has(p)) return ok(landingPage(p));
        String[] meta = ShareController.SITE_PAGES.get(p);
        if (meta != null) return ok(sitePage(p, meta));
        String qid = id != null && !id.isBlank() ? id : index().slugToId().get(p.substring(1));
        Question q = qid == null ? null : questions.findById(qid).orElse(null);
        if (q == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(MediaType.TEXT_HTML).body(shell("Not found", "/", "<h1>Not found</h1><p><a href=\"" + site + "/\">Interview Reader</a></p>", ""));
        return ok(question(p, q));
    }

    private ResponseEntity<String> ok(String html) {
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").contentType(MediaType.TEXT_HTML).body(html);
    }

    // ---------- pages ----------

    private String home() {
        StringBuilder b = new StringBuilder("<h1>Interview Reader: interview questions with answers and coding problems</h1>")
                .append("<p>Free interview questions with detailed answers for software engineers, plus coding problems you can run online and company interview roadmaps.</p><h2>Topics</h2><ul>");
        index().perTech().forEach((tech, n) -> b.append("<li>").append(esc(tech)).append(": ").append(n).append(" questions</li>"));
        b.append("</ul><h2>Pages</h2><ul>");
        ShareController.SITE_PAGES.forEach((path, m) -> b.append("<li><a href=\"").append(esc(site + path)).append("\">").append(esc(m[0])).append("</a>: ").append(esc(m[1])).append("</li>"));
        b.append("</ul><p>Every question has its own page; see <a href=\"").append(esc(site)).append("/sitemap.xml\">the sitemap</a>.</p>");
        return shell("Interview Reader: interview questions with answers", "/", b.toString(), "Free interview questions with detailed answers for Java, React, Node.js, Go, SQL, system design, Kafka and microservices, plus coding problems you can run online.");
    }

    @SuppressWarnings("unchecked")
    private String landingPage(String path) {
        Map<String, Object> pg = landing.build(path);
        StringBuilder b = new StringBuilder("<article><h1>").append(esc(String.valueOf(pg.get("h1")))).append("</h1>");
        for (var t : (Iterable<com.fasterxml.jackson.databind.JsonNode>) pg.get("intro")) b.append("<p>").append(esc(t.asText())).append("</p>");
        var qs = (java.util.List<Map<String, Object>>) pg.get("questions");
        if (!qs.isEmpty()) {
            b.append("<h2>Questions</h2><ul>");
            for (var q : qs) b.append("<li><a href=\"").append(esc(site + "/" + q.get("slug") + "?id=" + q.get("id"))).append("\">").append(esc(String.valueOf(q.get("title")))).append("</a></li>");
            b.append("</ul>");
        }
        var ps = (java.util.List<Map<String, Object>>) pg.get("problems");
        if (!ps.isEmpty()) {
            b.append("<h2>Coding problems</h2><ul>");
            for (var q : ps) b.append("<li><a href=\"").append(esc(site + "/practice?id=" + q.get("id"))).append("\">").append(esc(String.valueOf(q.get("title")))).append("</a> (").append(esc(String.valueOf(q.get("difficulty")))).append(")</li>");
            b.append("</ul>");
        }
        b.append("<h2>Related</h2><ul>");
        for (var l : (Iterable<com.fasterxml.jackson.databind.JsonNode>) pg.get("links")) b.append("<li><a href=\"").append(esc(site + l.path("url").asText())).append("\">").append(esc(l.path("label").asText())).append("</a></li>");
        b.append("</ul><h2>Frequently asked questions</h2>");
        java.util.List<Map<String, Object>> faqLd = new java.util.ArrayList<>();
        for (var f : (Iterable<com.fasterxml.jackson.databind.JsonNode>) pg.get("faq")) {
            b.append("<h3>").append(esc(f.path("q").asText())).append("</h3><p>").append(esc(f.path("a").asText())).append("</p>");
            faqLd.add(Map.of("@type", "Question", "name", f.path("q").asText(), "acceptedAnswer", Map.of("@type", "Answer", "text", f.path("a").asText())));
        }
        b.append("</article>");
        String ld = "";
        try { ld = "<script type=\"application/ld+json\">" + mapper.writeValueAsString(Map.of("@context", "https://schema.org", "@type", "FAQPage", "mainEntity", faqLd)).replace("</", "<\\/") + "</script>"; } catch (Exception ignored) { /* no structured data */ }
        return shell(String.valueOf(pg.get("title")), path, b.toString(), String.valueOf(pg.get("description")), ld);
    }

    private String sitePage(String path, String[] meta) {
        return shell(meta[0], path, "<h1>" + esc(meta[0]) + "</h1><p>" + esc(meta[1]) + "</p><p><a href=\"" + esc(site + "/") + "\">Interview Reader home</a></p>", meta[1]);
    }

    private String question(String path, Question q) {
        boolean readable = access.freeTechs().contains(q.getTech()) && access.isOpenToAll(q.getId(), q.getTech());
        String text = q.getQuestion() != null && !q.getQuestion().isBlank() ? q.getQuestion() : q.getTitle();
        String url = site + path + "?id=" + q.getId();
        StringBuilder b = new StringBuilder("<article><h1>").append(esc(text)).append("</h1><p>Topic: ").append(esc(q.getTech()))
                .append(q.getCategory() == null ? "" : ", " + esc(q.getCategory())).append(q.getDifficulty() == null ? "" : ". Level: " + esc(q.getDifficulty())).append(".</p>");
        String ld = "";
        String description = "Interview question with a detailed answer on Interview Reader.";
        if (readable && q.getAnswer() != null && !q.getAnswer().isBlank()) {
            b.append("<h2>Answer</h2><div style=\"white-space:pre-wrap\">").append(esc(q.getAnswer())).append("</div>");
            String plain = q.getAnswer().replaceAll("[`#*>_\\[\\]]", "").replaceAll("\\s+", " ").trim();
            description = plain.length() > 200 ? plain.substring(0, 197) + "..." : plain;
            try {
                Map<String, Object> qa = new LinkedHashMap<>();
                qa.put("@context", "https://schema.org"); qa.put("@type", "QAPage"); qa.put("url", url);
                Map<String, Object> main = new LinkedHashMap<>();
                main.put("@type", "Question"); main.put("name", text); main.put("answerCount", 1);
                main.put("acceptedAnswer", Map.of("@type", "Answer", "text", plain.length() > 5000 ? plain.substring(0, 5000) : plain));
                qa.put("mainEntity", main);
                ld = "<script type=\"application/ld+json\">" + mapper.writeValueAsString(qa).replace("</", "<\\/") + "</script>";
            } catch (Exception ignored) { /* the page works without structured data */ }
        } else {
            b.append("<p>The full answer to this question is available to Interview Reader members. <a href=\"").append(esc(site + "/premium")).append("\">See what is free and what Premium adds</a>.</p>");
        }
        b.append("</article>");
        return shell(text + " | " + q.getTech() + " interview question", path + "?id=" + q.getId(), b.toString(), description, ld);
    }

    // ---------- helpers ----------

    private String shell(String title, String path, String body, String description) { return shell(title, path, body, description, ""); }

    private String shell(String title, String path, String body, String description, String extraHead) {
        String url = esc(site + path);
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title>"
                + "<meta name=\"description\" content=\"" + esc(description) + "\"><link rel=\"canonical\" href=\"" + url + "\">"
                + "<meta property=\"og:title\" content=\"" + esc(title) + "\"><meta property=\"og:description\" content=\"" + esc(description) + "\">"
                + "<meta property=\"og:url\" content=\"" + url + "\">" + extraHead + "</head><body>" + body + "</body></html>";
    }

    private static String esc(String s) { return HtmlUtils.htmlEscape(s == null ? "" : s); }
}
