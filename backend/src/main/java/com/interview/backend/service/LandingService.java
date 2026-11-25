package com.interview.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.QuestionRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keyword landing pages (/java-interview-questions, /dsa/sliding-window, ...). The words live in resources/landing-pages.json, so a page is
 * added by editing that file; the question and problem lists are read from the database. The reader app and the crawler pages both use this.
 */
@Service
public class LandingService {

    private final Map<String, JsonNode> pages = new LinkedHashMap<>();
    private final QuestionRepository questions;
    private final CodingProblemRepository problems;
    private final ObjectMapper mapper;

    public LandingService(QuestionRepository questions, CodingProblemRepository problems, ObjectMapper mapper) throws Exception {
        this.questions = questions;
        this.problems = problems;
        this.mapper = mapper;
        try (InputStream in = new ClassPathResource("landing-pages.json").getInputStream()) {
            for (JsonNode p : mapper.readTree(in)) pages.put(p.path("path").asText(), p);
        }
    }

    public List<String> paths() {
        var all = new ArrayList<>(pages.keySet());
        for (String g : generated().paths()) if (!pages.containsKey(g)) all.add(g);
        return all;
    }

    public boolean has(String path) { return config(path) != null; }

    /** A page from landing-pages.json, or one made from the coding problems (see generated pages below), or null. */
    public JsonNode config(String path) {
        JsonNode p = pages.get(path);
        return p != null ? p : synth(path);
    }

    /** The page's text plus its question and problem lists, or null when there is no such page. */
    public Map<String, Object> build(String path) {
        JsonNode p = config(path);
        if (p == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("path", "title", "description", "h1")) out.put(k, p.path(k).asText());   // plain strings, not JSON nodes
        for (String k : List.of("intro", "links", "faq")) out.put(k, p.get(k));

        List<Map<String, Object>> qs = new ArrayList<>();
        if (p.hasNonNull("tech")) {
            String term = p.path("term").asText("").toLowerCase();
            int limit = p.path("limit").asInt(50);
            for (Object[] r : questions.topicQuestions(p.get("tech").asText(), term, PageRequest.of(0, limit))) {
                Map<String, Object> q = new LinkedHashMap<>();
                q.put("id", r[0]);
                q.put("title", r[2] == null || ((String) r[2]).isBlank() ? r[1] : r[2]);
                q.put("slug", ShareSlug.of((String) r[1]));
                q.put("difficulty", r[3]);
                qs.add(q);
            }
        }
        out.put("questions", qs);

        List<Map<String, Object>> ps = new ArrayList<>();
        String topic = p.path("problemTopic").asText(""), company = p.path("problemCompany").asText(""), difficulty = p.path("problemDifficulty").asText("");
        if (!topic.isEmpty() || !company.isEmpty() || !difficulty.isEmpty()) {
            int limit = p.path("problemLimit").asInt(50);
            for (var s : problems.findSummariesByOrderByIdAsc()) {
                if (!topic.isEmpty() && !csv(s.getTopics()).contains(topic)) continue;
                if (!company.isEmpty() && !csv(s.getCompanies()).contains(company)) continue;
                if (!difficulty.isEmpty() && !difficulty.equalsIgnoreCase(s.getDifficulty())) continue;
                ps.add(Map.of("id", s.getId(), "title", s.getTitle(), "difficulty", s.getDifficulty() == null ? "" : s.getDifficulty()));
                if (ps.size() >= limit) break;
            }
        }
        out.put("problems", ps);
        return out;
    }

    // ---------- generated pages ----------
    // Company, topic and difficulty pages made from the coding problems themselves, so they stay current and need no JSON entry:
    //   /companies/<company>/coding-interview-questions, /companies/<company>/<topic>-problems, /companies/<company>/<difficulty>-problems,
    //   /dsa/<topic> and /dsa/<topic>/<difficulty>.
    // A page exists only when it would list at least MIN problems (topic pages: TOPIC_MIN), so no page is empty or near-empty.

    static final int MIN = 8, TOPIC_MIN = 15;
    private static final List<String> DIFFS = List.of("basic", "intermediate", "advanced");
    private static final Pattern COMPANY_ALL = Pattern.compile("^/companies/([a-z0-9-]+)/coding-interview-questions$");
    private static final Pattern COMPANY_SUB = Pattern.compile("^/companies/([a-z0-9-]+)/([a-z0-9-]+)-problems$");
    private static final Pattern TOPIC = Pattern.compile("^/dsa/([a-z0-9-]+)$");
    private static final Pattern TOPIC_DIFF = Pattern.compile("^/dsa/([a-z0-9-]+)/(basic|intermediate|advanced)$");

    private record Row(String company, String topic, String diff, String title) {}
    private record Gen(Map<String, String> names, Map<String, Integer> n, List<String> paths, long at) {}
    private volatile Gen gen;

    static String slug(String s) { return s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", ""); }

    private Gen generated() {
        Gen g = gen;
        if (g != null && System.currentTimeMillis() - g.at() < 600_000) return g;
        Map<String, String> names = new LinkedHashMap<>();   // slug -> display name (companies "c:", topics "t:")
        Map<String, Integer> n = new LinkedHashMap<>();
        for (var s : problems.findSummariesByOrderByIdAsc()) {
            String d = s.getDifficulty() == null || s.getDifficulty().isBlank() ? null : slug(s.getDifficulty());
            for (String c : csv(s.getCompanies())) {
                String cs = slug(c); names.putIfAbsent("c:" + cs, c);
                n.merge("c:" + cs, 1, Integer::sum);
                if (d != null) n.merge("cd:" + cs + "|" + d, 1, Integer::sum);
                for (String t : csv(s.getTopics())) n.merge("ct:" + cs + "|" + slug(t), 1, Integer::sum);
            }
            for (String t : csv(s.getTopics())) {
                String ts = slug(t); names.putIfAbsent("t:" + ts, t);
                n.merge("t:" + ts, 1, Integer::sum);
                if (d != null) n.merge("td:" + ts + "|" + d, 1, Integer::sum);
            }
        }
        List<String> paths = new ArrayList<>();
        for (var e : n.entrySet()) {
            String k = e.getKey(); int v = e.getValue();
            String body = k.substring(k.indexOf(':') + 1);
            if (k.startsWith("c:") && v >= MIN) paths.add("/companies/" + body + "/coding-interview-questions");
            else if (k.startsWith("ct:") && v >= MIN) paths.add("/companies/" + body.replace('|', '/') + "-problems");
            else if (k.startsWith("cd:") && v >= MIN) paths.add("/companies/" + body.replace('|', '/') + "-problems");
            else if (k.startsWith("t:") && v >= TOPIC_MIN) paths.add("/dsa/" + body);
            else if (k.startsWith("td:") && v >= MIN) paths.add("/dsa/" + body.replace('|', '/'));
        }
        return gen = new Gen(names, n, paths, System.currentTimeMillis());
    }

    private JsonNode synth(String path) {
        Gen g = generated();
        Matcher m;
        if ((m = COMPANY_ALL.matcher(path)).matches()) return companyPage(g, path, m.group(1), null, null);
        if ((m = COMPANY_SUB.matcher(path)).matches()) {
            String c = m.group(1), x = m.group(2);
            return DIFFS.contains(x) ? companyPage(g, path, c, null, x) : companyPage(g, path, c, x, null);
        }
        if ((m = TOPIC.matcher(path)).matches()) return topicPage(g, path, m.group(1), null);
        if ((m = TOPIC_DIFF.matcher(path)).matches()) return topicPage(g, path, m.group(1), m.group(2));
        return null;
    }

    private static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }

    /** The difficulty split and the commonest other topics (or companies) among the problems that pass the filter. */
    private String mix(String company, String topic, String diff, boolean companiesInstead) {
        int[] d = new int[3];
        Map<String, Integer> other = new LinkedHashMap<>();
        for (var s : problems.findSummariesByOrderByIdAsc()) {
            var cs = csv(s.getCompanies()).stream().map(LandingService::slug).toList();
            var ts = csv(s.getTopics()).stream().map(LandingService::slug).toList();
            if (company != null && !cs.contains(company)) continue;
            if (topic != null && !ts.contains(topic)) continue;
            String sd = s.getDifficulty() == null ? "" : slug(s.getDifficulty());
            if (diff != null && !diff.equals(sd)) continue;
            int i = DIFFS.indexOf(sd); if (i >= 0) d[i]++;
            if (companiesInstead) csv(s.getCompanies()).forEach(c -> other.merge(c, 1, Integer::sum));
            else csv(s.getTopics()).stream().filter(t -> !slug(t).equals(topic)).forEach(t -> other.merge(t, 1, Integer::sum));
        }
        String top = other.entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue()).limit(4).map(Map.Entry::getKey).collect(java.util.stream.Collectors.joining(", "));
        return "By difficulty they split into " + d[0] + " basic, " + d[1] + " intermediate and " + d[2] + " advanced."
                + (top.isEmpty() ? "" : " The " + (companiesInstead ? "companies that ask them most often are " : "topics they most often combine with are ") + top + ".");
    }

    private ObjectNode node(String path, String title, String description, String h1, List<String> intro, List<String[]> links, List<String[]> faq) {
        ObjectNode o = mapper.createObjectNode();
        o.put("path", path); o.put("title", title); o.put("description", description); o.put("h1", h1);
        ArrayNode i = o.putArray("intro"); intro.forEach(i::add);
        ArrayNode l = o.putArray("links"); links.forEach(x -> l.addObject().put("label", x[0]).put("url", x[1]));
        ArrayNode f = o.putArray("faq"); faq.forEach(x -> f.addObject().put("q", x[0]).put("a", x[1]));
        o.put("problemLimit", 80);
        return o;
    }

    private ObjectNode companyPage(Gen g, String path, String cs, String ts, String ds) {
        String company = g.names().get("c:" + cs);
        if (company == null) return null;
        int count = ds != null ? g.n().getOrDefault("cd:" + cs + "|" + ds, 0) : ts != null ? g.n().getOrDefault("ct:" + cs + "|" + ts, 0) : g.n().getOrDefault("c:" + cs, 0);
        if (count < MIN) return null;
        String topic = ts == null ? null : g.names().get("t:" + ts);
        if (ts != null && topic == null) return null;
        String what = ds != null ? cap(ds) + " " : topic != null ? topic + " " : "";
        String mix = mix(cs, ts, ds, false);
        List<String> intro = List.of(
                count + " " + what.toLowerCase().replace("basic ", "basic ") + "coding problems are tagged as asked at " + company + " in interviews and online assessments reported by candidates. " + mix,
                "Reported questions change over time and are not a guarantee of what you will be asked, so use the list to see which patterns " + company + " tends to test. For each problem, practise explaining your approach, its time and space cost and the edge cases before you write the code; every problem opens in an editor that runs your code against test cases.");
        List<String[]> links = new ArrayList<>();
        if (ts != null || ds != null) links.add(new String[]{company + " coding interview questions", "/companies/" + cs + "/coding-interview-questions"});
        if (ts != null) links.add(new String[]{topic + " problems", "/dsa/" + ts});
        for (String d : DIFFS) if (ds == null && g.n().getOrDefault("cd:" + cs + "|" + d, 0) >= MIN) links.add(new String[]{company + " " + d + " problems", "/companies/" + cs + "/" + d + "-problems"});
        if (ts == null && ds == null) g.n().entrySet().stream().filter(e -> e.getKey().startsWith("ct:" + cs + "|") && e.getValue() >= MIN)
                .sorted((a, b) -> b.getValue() - a.getValue()).limit(8).forEach(e -> {
                    String t = e.getKey().substring(e.getKey().indexOf('|') + 1);
                    links.add(new String[]{company + " " + g.names().get("t:" + t) + " problems", "/companies/" + cs + "/" + t + "-problems"});
                });
        links.add(new String[]{"Company interview roadmaps", "/roadmaps"});
        links.add(new String[]{"All interview guides", "/interview-questions"});
        String h1 = company + " " + what + "Coding Interview Questions";
        ObjectNode o = node(path, company + " " + what + "Problems: " + count + " Coding Interview Questions", count + " " + what.toLowerCase() + "coding problems reported as asked at " + company + ". Practise each one online with test cases.",
                ts == null && ds == null ? company + " Coding Interview Questions" : h1, intro, links,
                List.of(new String[]{"How should I use the " + company + " problem list?", "Start with the basic problems, then the intermediate and advanced ones, and note which topics repeat. Solve each under a timer, then read the explanation."},
                        new String[]{"Are these the exact " + company + " interview questions?", "They are problems candidates reported being asked. Companies rotate questions, so use them to learn the patterns, not to predict the exact question."}));
        o.put("problemCompany", company);
        if (topic != null) o.put("problemTopic", topic);
        if (ds != null) o.put("problemDifficulty", ds);
        return o;
    }

    private ObjectNode topicPage(Gen g, String path, String ts, String ds) {
        String topic = g.names().get("t:" + ts);
        if (topic == null) return null;
        int count = ds != null ? g.n().getOrDefault("td:" + ts + "|" + ds, 0) : g.n().getOrDefault("t:" + ts, 0);
        if (count < (ds != null ? MIN : TOPIC_MIN)) return null;
        String what = ds != null ? cap(ds) + " " : "";
        List<String> intro = List.of(
                count + " " + what.toLowerCase() + topic + " problems from real coding interviews, each with test cases you can run online. " + mix(null, ts, ds, true),
                "Solve a few problems of each level, name the pattern after each one and revisit the ones that needed a hint a week later. Practise stating the time and space complexity and the edge cases before you code.");
        List<String[]> links = new ArrayList<>();
        if (ds != null) links.add(new String[]{topic + " problems", "/dsa/" + ts});
        for (String d : DIFFS) if (ds == null && g.n().getOrDefault("td:" + ts + "|" + d, 0) >= MIN) links.add(new String[]{cap(d) + " " + topic + " problems", "/dsa/" + ts + "/" + d});
        links.add(new String[]{"Practice coding problems online", "/problems"});
        links.add(new String[]{"All interview guides", "/interview-questions"});
        ObjectNode o = node(path, what + topic + " Problems from Real Interviews: " + count + " with Practice", count + " " + what.toLowerCase() + topic + " coding interview problems with test cases, from basic to advanced. Practise online in 11 languages.",
                what + topic + " Problems for Coding Interviews", intro, links,
                List.of(new String[]{"How do I get good at " + topic.toLowerCase() + " problems?", "Practise by level, name the pattern after you solve each problem and review the ones you needed hints for. The list is ordered so you can start with the basic ones."},
                        new String[]{"Can I run " + topic.toLowerCase() + " problems online here?", "Yes. Each problem opens in an editor that runs your code against test cases in Java, Python, C++, Go, JavaScript and more."}));
        o.put("problemTopic", topic);
        if (ds != null) o.put("problemDifficulty", ds);
        return o;
    }

    private static List<String> csv(String s) {
        return s == null || s.isBlank() ? List.of() : java.util.Arrays.stream(s.split(",")).map(String::trim).toList();
    }
}
