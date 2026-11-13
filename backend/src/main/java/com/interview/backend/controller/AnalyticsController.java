package com.interview.backend.controller;

import com.interview.backend.entity.PageView;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserEvent;
import com.interview.backend.repository.UserEventRepository;
import com.interview.backend.repository.PageViewRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import com.interview.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final PageViewRepository pageViews;
    private final com.interview.backend.service.PointsService pointsService;
    private final UserRepository users;
    private final QuestionRepository questions;
    private final UserProgressRepository progress;
    private final UserEventRepository events;
    private final PresenceController presence;

    /** A member counts as "reading" once they spend this long on, or scroll this far into, an answer. */
    private static final int READ_SECONDS = 30, READ_SCROLL = 50;

    // ---------- public: record an event ----------

    public record TrackRequest(String path, String questionId, String referrer,
                               String sessionId, String device, String theme,
                               String utmSource, String utmMedium, String utmCampaign, String utmContent) {}

    /**
     * Fire-and-forget event recording. Public, because anonymous visitors are
     * exactly what we want to measure. Never returns an error to the client —
     * analytics must not break the page.
     */
    @PostMapping("/track")
    public ResponseEntity<Void> track(@RequestBody TrackRequest req, HttpServletRequest http) {
        try {
            PageView pv = new PageView();
            pv.setPath(trim(req.path(), 512));
            pv.setQuestionId(trim(req.questionId(), 100));
            pv.setReferrer(trim(req.referrer(), 512));
            pv.setReferrerHost(referrerHost(req.referrer(), http));
            pv.setSessionId(trim(req.sessionId(), 64));
            pv.setDevice(trim(req.device(), 20));
            pv.setTheme(trim(req.theme(), 10));
            pv.setUserId(currentUserId());   // resolved from the JWT, never client-supplied
            pv.setUtmSource(trim(req.utmSource(), 100));
            pv.setUtmMedium(trim(req.utmMedium(), 100));
            pv.setUtmCampaign(trim(req.utmCampaign(), 100));
            pv.setUtmContent(trim(req.utmContent(), 100));
            pageViews.save(pv);
        } catch (Exception ignored) {
            // swallow: a failed metric must never surface to the visitor
        }
        return ResponseEntity.noContent().build();
    }

    public record EventRequest(String type, String questionId, String label,
                               Integer scrollPct, Integer seconds, String sessionId) {}

    /** Batched engagement events (reads + clicks). Same never-fail contract as /track. */
    @PostMapping("/events")
    public ResponseEntity<Void> events(@RequestBody List<EventRequest> batch) {
        try {
            if (batch == null) return ResponseEntity.noContent().build();
            Long userId = currentUserId();
            List<UserEvent> rows = new ArrayList<>();
            for (EventRequest r : batch.subList(0, Math.min(batch.size(), 50))) {
                if (!"read".equals(r.type()) && !"click".equals(r.type()) && !"funnel".equals(r.type())) continue;
                UserEvent e = new UserEvent();
                e.setType(r.type());
                e.setQuestionId(trim(r.questionId(), 100));
                e.setLabel(trim(r.label(), 80));
                e.setScrollPct(r.scrollPct() == null ? null : Math.min(Math.max(r.scrollPct(), 0), 100));
                e.setSeconds(r.seconds() == null ? null : Math.min(Math.max(r.seconds(), 0), 3600));
                e.setSessionId(trim(r.sessionId(), 64));
                e.setUserId(userId);
                rows.add(e);
            }
            events.saveAll(rows);
            // A qualifying read (30 seconds or half the page) of a question earns points the first time.
            for (UserEvent e : rows)
                if ("read".equals(e.getType()) && e.getUserId() != null && e.getQuestionId() != null
                        && ((e.getSeconds() != null && e.getSeconds() >= 30) || (e.getScrollPct() != null && e.getScrollPct() >= 50)))
                    pointsService.read(e.getUserId(), e.getQuestionId());
        } catch (Exception ignored) {
            // swallow: a failed metric must never surface to the visitor
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * The signed-in user, if the request carried a valid token. Anonymous visitors
     * return null. Taken from the security context rather than the request body so a
     * client cannot attribute views to someone else.
     */
    private Long currentUserId() {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;
            String email = auth.getName();
            if (email == null || "anonymousUser".equals(email)) return null;
            return users.findByEmail(email).map(User::getId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /** Group traffic by source host; anything from our own origin counts as internal. */
    private String referrerHost(String referrer, HttpServletRequest http) {
        if (referrer == null || referrer.isBlank()) return "direct";
        try {
            String host = URI.create(referrer).getHost();
            if (host == null || host.isBlank()) return "direct";
            String self = http.getServerName();
            if (host.equalsIgnoreCase(self)) return "internal";
            return host.replaceFirst("^www\\.", "").toLowerCase();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    // ---------- admin: dashboard ----------

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(@RequestParam(defaultValue = "30") int days) {
        int window = Math.min(Math.max(days, 1), 365);
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        Instant dayAgo = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windowDays", window);

        // Traffic
        Map<String, Object> traffic = new LinkedHashMap<>();
        traffic.put("totalViews", pageViews.count());
        traffic.put("viewsInWindow", pageViews.countByCreatedAtAfter(since));
        traffic.put("viewsToday", pageViews.countByCreatedAtAfter(dayAgo));
        traffic.put("uniqueVisitors", pageViews.countUniqueVisitors());
        traffic.put("uniqueInWindow", pageViews.countUniqueVisitorsSince(since));
        out.put("traffic", traffic);

        // Who those visitors were: new vs returning, signed-in vs anonymous.
        long unique = pageViews.countUniqueVisitorsSince(since);
        long newVisitors = Math.min(pageViews.countNewVisitorsSince(since), unique);
        long viewsWindow = pageViews.countByCreatedAtAfter(since);
        long signedInViews = pageViews.countSignedInViewsSince(since);

        Map<String, Object> audience = new LinkedHashMap<>();
        audience.put("unique", unique);
        audience.put("newVisitors", newVisitors);
        audience.put("returningVisitors", Math.max(0, unique - newVisitors));
        audience.put("engagedVisitors", pageViews.countEngagedVisitorsSince(since));
        audience.put("identifiedUsers", pageViews.countIdentifiedUsersSince(since));
        audience.put("signedInViews", signedInViews);
        audience.put("anonymousViews", Math.max(0, viewsWindow - signedInViews));
        audience.put("registeredMembers", users.count());
        audience.put("viewsPerVisitor", unique > 0 ? Math.round((viewsWindow * 10.0) / unique) / 10.0 : 0);
        out.put("audience", audience);

        // Where visitors come from
        out.put("referrers", pageViews.topReferrers(since, PageRequest.of(0, 10)).stream()
                .map(r -> Map.of("source", r[0] == null ? "direct" : r[0],
                                 "views", ((Number) r[1]).longValue(),
                                 "visitors", ((Number) r[2]).longValue()))
                .collect(Collectors.toList()));

        // Most-opened questions, resolved to their titles
        List<Object[]> top = pageViews.topQuestions(since, PageRequest.of(0, 10));
        List<String> ids = top.stream().map(r -> (String) r[0]).toList();
        Map<String, Question> byId = questions.findAllById(ids).stream()
                .collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
        Map<String, Object[]> readById = ids.isEmpty() ? Map.of() : events.readStatsFor(since, ids).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> r, (a, b) -> a));
        out.put("topQuestions", top.stream().map(r -> {
            Question q = byId.get((String) r[0]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r[0]);
            m.put("title", q != null ? q.getTitle() : "(deleted)");
            m.put("tech", q != null ? q.getTech() : null);
            m.put("views", ((Number) r[1]).longValue());
            Object[] rs = readById.get((String) r[0]);
            m.put("avgScroll", rs == null || rs[1] == null ? null : Math.round(((Number) rs[1]).doubleValue()));
            m.put("avgSeconds", rs == null ? null : perSession(rs[2], rs[3]));
            return m;
        }).collect(Collectors.toList()));

        out.put("countries", users.countByCountry().stream()
                .map(r -> Map.of("country", r[0] == null ? "Unknown" : r[0],
                                 "members", ((Number) r[1]).longValue()))
                .collect(Collectors.toList()));

        out.put("devices", pageViews.deviceBreakdown(since).stream()
                .map(r -> Map.of("device", r[0] == null ? "unknown" : r[0],
                                 "views", ((Number) r[1]).longValue()))
                .collect(Collectors.toList()));

        out.put("daily", pageViews.dailySeries(since).stream()
                .map(r -> Map.of("date", String.valueOf(r[0]),
                                 "views", ((Number) r[1]).longValue(),
                                 "visitors", ((Number) r[2]).longValue()))
                .collect(Collectors.toList()));

        // Signups — the "any new joiners?" panel
        Map<String, Object> signups = new LinkedHashMap<>();
        signups.put("total", users.count());
        signups.put("today", users.countByCreatedAtAfter(dayAgo));
        signups.put("thisWeek", users.countByCreatedAtAfter(weekAgo));
        signups.put("inWindow", users.countByCreatedAtAfter(since));
        out.put("signups", signups);

        out.put("engagement", engagement(since));

        // Campaign performance: visits per utm_source + utm_campaign, and signups from the same tags.
        out.put("campaigns", pageViews.topCampaigns(since, PageRequest.of(0, 15)).stream()
                .map(r -> Map.of("source", r[0], "campaign", r[1] == null ? "" : r[1],
                                 "views", ((Number) r[2]).longValue(),
                                 "visitors", ((Number) r[3]).longValue()))
                .collect(Collectors.toList()));
        out.put("resumeBuilder", pageViews.resumeBuilderPlacements(since).stream()
                .map(r -> Map.of("placement", r[0] == null ? "unknown" : r[0],
                                 "views", ((Number) r[1]).longValue(),
                                 "visitors", ((Number) r[2]).longValue(),
                                 "signedIn", ((Number) r[3]).longValue()))
                .collect(Collectors.toList()));
        out.put("signupCampaigns", users.countSignupsByCampaign().stream()
                .map(r -> Map.of("source", r[0], "campaign", r[1] == null ? "" : r[1],
                                 "signups", ((Number) r[2]).longValue()))
                .collect(Collectors.toList()));

        out.put("content", Map.of(
                "totalQuestions", questions.count(),
                "totalProgressRows", progress.count()));

        return ResponseEntity.ok(out);
    }

    // ---------- admin: conversion funnel ----------

    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    // One row per visitor session in the window. A session with a single view and no read, scroll or click
    // ("no interaction") is most likely a bot or link preview, so it is reported but left out of the funnel.
    private static final String SESSIONS = """
        WITH v AS (SELECT session_id, COUNT(*) views, COUNT(DISTINCT question_id) qs, COUNT(DISTINCT DATE(created_at)) days,
                          BOOL_OR(user_id IS NOT NULL) signed
                   FROM page_views WHERE created_at > ? AND path NOT LIKE '/admin%' AND session_id IS NOT NULL GROUP BY session_id),
             f AS (SELECT DISTINCT ON (session_id) session_id, referrer_host, device
                   FROM page_views WHERE created_at > ? AND path NOT LIKE '/admin%' ORDER BY session_id, created_at),
             e AS (SELECT session_id,
                          BOOL_OR(type = 'read' AND (seconds >= 30 OR scroll_pct >= 50)) engaged,
                          -- auth_open is recorded by the dialog itself (sent after sign-in, so it may carry the new user's id);
                          -- the button labels cover visits from before it existed.
                          BOOL_OR(label LIKE 'auth_open:%' OR (user_id IS NULL AND label IN ('Sign up', 'Log in / Sign up', 'Log in',
                                  'Start practicing free →', 'Sign in or create a free account', 'Create a free account'))) opened_auth,
                          BOOL_OR(label = 'auth_submit:signup') submitted
                   FROM user_events WHERE created_at > ? GROUP BY session_id)
        SELECT v.*, f.referrer_host, f.device, COALESCE(e.engaged, false) engaged, COALESCE(e.opened_auth, false) opened_auth,
               COALESCE(e.submitted, false) submitted, (v.views = 1 AND e.session_id IS NULL AND NOT v.signed) no_interaction
        FROM v JOIN f USING (session_id) LEFT JOIN e USING (session_id)
        """;

    /**
     * Engagement across the main loops in one call: the daily challenge, code practice, referrals, and a "who does what"
     * split that tells read-only members from solvers. All counts are over the window and native SQL so it stays cheap.
     */
    @GetMapping("/engagement")
    public Map<String, Object> engagementBreakdown(@RequestParam(defaultValue = "30") int days) {
        int window = Math.min(Math.max(days, 1), 365);
        java.sql.Timestamp since = java.sql.Timestamp.from(Instant.now().minus(window, ChronoUnit.DAYS));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windowDays", window);

        // Daily challenge: how many members reached it, read today's question, solved today's problem, or both.
        Map<String, Object> daily = new LinkedHashMap<>();
        daily.put("pageVisitors", jdbc.queryForObject("SELECT COUNT(DISTINCT session_id) FROM page_views WHERE path = '/question-of-the-day' AND created_at > ?", Long.class, since));
        daily.put("pageMembers", jdbc.queryForObject("SELECT COUNT(DISTINCT user_id) FROM page_views WHERE path = '/question-of-the-day' AND user_id IS NOT NULL AND created_at > ?", Long.class, since));
        daily.put("readEvents", jdbc.queryForObject("SELECT COUNT(DISTINCT user_id) FROM point_events WHERE kind = 'read' AND created_at > ?", Long.class, since));
        daily.put("solveEvents", jdbc.queryForObject("SELECT COUNT(DISTINCT user_id) FROM point_events WHERE kind = 'solve' AND created_at > ?", Long.class, since));
        daily.put("checkins", jdbc.queryForObject("SELECT COUNT(DISTINCT user_id) FROM point_events WHERE kind = 'login' AND created_at > ?", Long.class, since));
        daily.put("bothSameDay", jdbc.queryForObject(
                "SELECT COUNT(*) FROM (SELECT user_id, DATE(created_at AT TIME ZONE 'Asia/Kolkata') d FROM point_events WHERE kind IN ('read','solve') AND created_at > ? " +
                "GROUP BY user_id, d HAVING COUNT(DISTINCT kind) = 2) t", Long.class, since));
        daily.put("promoOpens", jdbc.queryForObject("SELECT COUNT(DISTINCT session_id) FROM user_events WHERE label IN ('daily_promo_open','qotd_card_read','qotd_card_solve','qotd_card_banner','qotd_page_solve') AND created_at > ?", Long.class, since));
        out.put("daily", daily);

        // Code practice: who runs code, how many submit, how many have an accepted solve.
        Map<String, Object> practice = new LinkedHashMap<>();
        practice.put("submitters", jdbc.queryForObject("SELECT COUNT(DISTINCT user_email) FROM code_submissions WHERE created_at > ?", Long.class, since));
        practice.put("submissions", jdbc.queryForObject("SELECT COUNT(*) FROM code_submissions WHERE created_at > ?", Long.class, since));
        practice.put("solvers", jdbc.queryForObject("SELECT COUNT(DISTINCT user_email) FROM code_submissions WHERE status = 'Accepted' AND created_at > ?", Long.class, since));
        practice.put("solvedProblems", jdbc.queryForObject("SELECT COUNT(DISTINCT problem_id) FROM code_submissions WHERE status = 'Accepted' AND created_at > ?", Long.class, since));
        practice.put("byLanguage", jdbc.queryForList("SELECT language, COUNT(*) submissions, COUNT(*) FILTER (WHERE status='Accepted') accepted FROM code_submissions WHERE created_at > ? GROUP BY 1 ORDER BY 2 DESC LIMIT 10", since));
        practice.put("topSolvers", jdbc.queryForList(
                "SELECT lower(s.user_email) email, u.name, COUNT(DISTINCT s.problem_id) solved, COUNT(*) submissions " +
                "FROM code_submissions s LEFT JOIN app_users u ON lower(u.email) = lower(s.user_email) " +
                "WHERE s.status = 'Accepted' AND s.created_at > ? GROUP BY 1,2 ORDER BY solved DESC LIMIT 20", since));
        out.put("practice", practice);

        // Dark vs light: each visitor session and each member counted once, by the theme of their latest tracked view.
        out.put("theme", jdbc.queryForMap(
                "WITH last AS (SELECT DISTINCT ON (session_id) session_id, user_id, theme FROM page_views WHERE theme IS NOT NULL AND created_at > ? ORDER BY session_id, created_at DESC) " +
                "SELECT COUNT(*) FILTER (WHERE theme = 'dark') dark_sessions, COUNT(*) FILTER (WHERE theme = 'light') light_sessions, " +
                "COUNT(DISTINCT user_id) FILTER (WHERE theme = 'dark' AND user_id IS NOT NULL) dark_members, " +
                "COUNT(DISTINCT user_id) FILTER (WHERE theme = 'light' AND user_id IS NOT NULL) light_members FROM last", since));

        // Who does what: read-only vs solve-only vs both, using point events in the window.
        Map<String, Object> mix = jdbc.queryForMap(
                "WITH per AS (SELECT user_id, BOOL_OR(kind='read') r, BOOL_OR(kind='solve') s FROM point_events WHERE kind IN ('read','solve') AND created_at > ? GROUP BY user_id) " +
                "SELECT COUNT(*) FILTER (WHERE r AND NOT s) read_only, COUNT(*) FILTER (WHERE s AND NOT r) solve_only, COUNT(*) FILTER (WHERE r AND s) both, COUNT(*) active FROM per",
                since);
        out.put("split", mix);

        // Referrals: who referred, and how many of their referrals actually signed in or did anything.
        Map<String, Object> refer = new LinkedHashMap<>();
        refer.put("referrers", jdbc.queryForObject("SELECT COUNT(DISTINCT referred_by) FROM app_users WHERE referred_by IS NOT NULL AND created_at > ?", Long.class, since));
        refer.put("referredSignups", jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE referred_by IS NOT NULL AND created_at > ?", Long.class, since));
        refer.put("activeReferred", jdbc.queryForObject(
                "SELECT COUNT(DISTINCT u.id) FROM app_users u JOIN point_events p ON p.user_id = u.id " +
                "WHERE u.referred_by IS NOT NULL AND u.created_at > ? AND p.created_at > ?", Long.class, since, since));
        refer.put("topReferrers", jdbc.queryForList(
                "SELECT r.id, r.email, r.name, COUNT(u.id) referrals, " +
                "COUNT(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM point_events p WHERE p.user_id = u.id AND p.created_at > ?)) active " +
                "FROM app_users r JOIN app_users u ON u.referred_by = r.id " +
                "WHERE u.created_at > ? GROUP BY 1,2,3 ORDER BY referrals DESC LIMIT 20", since, since));
        out.put("referrals", refer);

        return out;
    }

    @GetMapping("/funnel")
    public Map<String, Object> funnel(@RequestParam(defaultValue = "30") int days) {
        int window = Math.min(Math.max(days, 1), 365);
        java.sql.Timestamp since = java.sql.Timestamp.from(Instant.now().minus(window, ChronoUnit.DAYS));
        String agg = """
            SELECT COUNT(*) visitors,
                   COUNT(*) FILTER (WHERE no_interaction) no_interaction,
                   COUNT(*) FILTER (WHERE NOT no_interaction) real_visitors,
                   COUNT(*) FILTER (WHERE NOT no_interaction AND views = 1) bounced,
                   COUNT(*) FILTER (WHERE NOT no_interaction AND qs >= 1) opened_question,
                   COUNT(*) FILTER (WHERE engaged) engaged_read,
                   COUNT(*) FILTER (WHERE qs >= 3) read_three,
                   COUNT(*) FILTER (WHERE opened_auth) opened_signup,
                   COUNT(*) FILTER (WHERE submitted) submitted_signup,
                   COUNT(*) FILTER (WHERE signed) signed_in,
                   COUNT(*) FILTER (WHERE NOT no_interaction AND days >= 2) returned
            FROM (%s) s""".formatted(SESSIONS);
        Map<String, Object> t = jdbc.queryForMap(agg, since, since, since);
        long newMembers = users.countByCreatedAtAfter(since.toInstant());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windowDays", window);
        out.put("totals", t);
        out.put("newMembers", newMembers);
        String split = """
            SELECT %s k, COUNT(*) visitors, COUNT(*) FILTER (WHERE views = 1) bounced,
                   COUNT(*) FILTER (WHERE opened_auth) opened_signup, COUNT(*) FILTER (WHERE signed) signed_in
            FROM (%s) s WHERE NOT no_interaction GROUP BY 1 ORDER BY 2 DESC LIMIT 10""";
        out.put("bySource", jdbc.queryForList(split.formatted("COALESCE(referrer_host, 'direct')", SESSIONS), since, since, since));
        out.put("byDevice", jdbc.queryForList(split.formatted("COALESCE(device, 'unknown')", SESSIONS), since, since, since));
        // Where the sign-up dialog was opened, and why sign-ups and logins failed (recorded by the dialog itself).
        String labels = """
            SELECT SUBSTRING(label FROM %d) k, COUNT(DISTINCT session_id) sessions
            FROM user_events WHERE created_at > ? AND label LIKE ? GROUP BY 1 ORDER BY 2 DESC LIMIT 10""";
        out.put("signupOpenedFrom", jdbc.queryForList(labels.formatted("auth_open:".length() + 1), since, "auth_open:%"));
        out.put("authErrors", jdbc.queryForList(labels.formatted("auth_error:".length() + 1), since, "auth_error:%"));
        return out;
    }

    /** Scroll/read-time/click analytics plus who is actually using the site vs. only signing in. */
    private Map<String, Object> engagement(Instant since) {
        Map<String, Object> out = new LinkedHashMap<>();

        Object[] t = events.readTotals(since).get(0);
        out.put("avgScroll", t[0] == null ? 0 : Math.round(((Number) t[0]).doubleValue()));
        out.put("avgReadSeconds", perSession(t[1], t[2]));

        out.put("topClicks", events.topClicks(since, PageRequest.of(0, 15)).stream()
                .map(r -> Map.of("label", r[0], "clicks", ((Number) r[1]).longValue()))
                .collect(Collectors.toList()));

        // ponytail: loads every active member for the window; paginate if that list reaches thousands.
        long loggedInOnly = 0, browsing = 0, reading = 0;
        List<Map<String, Object>> members = new ArrayList<>();
        for (Object[] r : events.memberActivity(since)) {
            long views = ((Number) r[3]).longValue();
            long secs = ((Number) r[4]).longValue();
            long scroll = ((Number) r[5]).longValue();
            long clicks = ((Number) r[6]).longValue();
            String status = secs >= READ_SECONDS || scroll >= READ_SCROLL ? "reading"
                    : views > 0 || clicks > 0 ? "browsing" : "logged-in only";
            switch (status) {
                case "reading" -> reading++;
                case "browsing" -> browsing++;
                default -> loggedInOnly++;
            }
            if (members.size() < 50) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("email", r[0]);
                m.put("name", r[1] == null ? "" : r[1]);
                m.put("lastLogin", r[2] == null ? null : String.valueOf(r[2]));
                m.put("lastActive", r[7] == null ? null : String.valueOf(r[7]));
                m.put("views", views);
                m.put("readSeconds", secs);
                m.put("maxScroll", scroll);
                m.put("clicks", clicks);
                m.put("status", status);
                m.put("location", r[9] == null ? (r[8] == null ? "" : r[8]) : r[9] + ", " + r[8]);
                m.put("username", r[10] == null ? "" : r[10]);   // links the row to the public profile /u/{username}
                members.add(m);
            }
        }
        out.put("statusCounts", Map.of("reading", reading, "browsing", browsing, "loggedInOnly", loggedInOnly));
        out.put("members", members);
        return out;
    }

    private static long perSession(Object totalSeconds, Object sessions) {
        long n = sessions == null ? 0 : ((Number) sessions).longValue();
        return n == 0 ? 0 : ((Number) totalSeconds).longValue() / n;
    }

    /** Who is online right now: signed-in members by name, plus how many anonymous visitors. Admin only (under /analytics/**). */
    /** The money path in order: distinct sessions that reached each step (recorded by the app as "funnel" events). */
    @GetMapping("/money-funnel")
    public Map<String, Object> moneyFunnel(@RequestParam(defaultValue = "30") int days) {
        int window = Math.min(Math.max(days, 1), 365);
        Instant since = Instant.now().minus(window, ChronoUnit.DAYS);
        Map<String, Long> seen = new HashMap<>();
        for (Object[] r : events.funnelSteps(since)) seen.put(String.valueOf(r[0]), ((Number) r[1]).longValue());
        List<String> order = List.of("goal_set", "first_answer", "free_limit_hit", "paywall_seen", "pricing_viewed", "checkout_started", "paid");
        List<Map<String, Object>> steps = new ArrayList<>();
        for (String k : order) steps.add(Map.of("step", k, "sessions", seen.getOrDefault(k, 0L)));
        return Map.of("days", window, "steps", steps);
    }

    @GetMapping("/online")
    public Map<String, Object> online() {
        Map<String, Object> snap = presence.snapshot();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> members = (List<Map<String, Object>>) snap.get("members");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> m : members) {
            Map<String, Object> row = new LinkedHashMap<>(m);
            users.findByEmail((String) m.get("email")).ifPresent(u -> {
                row.put("name", u.getName() == null ? "" : u.getName());
                row.put("username", u.getUsername() == null ? "" : u.getUsername());
            });
            out.add(row);
        }
        return Map.of("members", out, "visitors", snap.get("visitors"));
    }

    /** Recent signups feed. `since` is an ISO instant so the UI can badge new ones. */
    @GetMapping("/signups")
    public ResponseEntity<Map<String, Object>> signups(
            @RequestParam(required = false) String since,
            @RequestParam(defaultValue = "20") int limit) {

        int n = Math.min(Math.max(limit, 1), 100);
        List<User> recent = users.findAllByOrderByCreatedAtDesc(PageRequest.of(0, n));

        long newCount = 0;
        if (since != null && !since.isBlank()) {
            try {
                newCount = users.countByCreatedAtAfter(Instant.parse(since));
            } catch (Exception ignored) { /* bad cursor: report 0 rather than failing */ }
        }

        return ResponseEntity.ok(Map.of(
                "newSince", newCount,
                "users", recent.stream().map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("username", u.getUsername() == null ? "" : u.getUsername());
                    m.put("email", u.getEmail());
                    m.put("name", u.getName() == null ? "" : u.getName());
                    m.put("joinedAt", u.getCreatedAt());
                    return m;
                }).collect(Collectors.toList())));
    }
}
