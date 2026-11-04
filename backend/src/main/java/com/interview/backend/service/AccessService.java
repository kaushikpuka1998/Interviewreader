package com.interview.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.interview.backend.entity.Question;
import com.interview.backend.repository.QuestionRepository;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Decides which topics a caller may read.
 *
 * Signed-out visitors get a free sample (configured by app.free-techs) so the site
 * stays crawlable and browsable; everything else needs an account. Enforced here on
 * the server rather than only hidden in the UI, since the API is public.
 *
 * On top of that, some topics are only a free preview for everyone but Premium members (app.access.teasers, e.g. "hld:5,design-patterns:5,java:50%"):
 * the first N questions of the topic, or the first share of it, can be read; the rest show as locked, with no answer in the response.
 * Premium members and admins read everything. The company-wise filters are Premium too, except a few free coding-problem companies.
 */
@Service
public class AccessService {

    private final Set<String> freeTechs;
    private final Map<String, Teaser> teasers;
    private final Set<String> freeProblemCompanies;   // lower-case names
    private final java.util.List<String> freeProblemCompanyNames;

    /** A topic's free preview: the first {@code count} questions, or the first {@code share} (0-1) of the topic. */
    record Teaser(int count, double share) {
        int freeOf(int total) { return share > 0 ? (int) Math.ceil(total * share) : Math.min(count, total); }
    }

    // Both are optional extras wired after construction; they are not needed to answer the free-topic questions below.
    @org.springframework.beans.factory.annotation.Autowired @org.springframework.context.annotation.Lazy
    private BillingService billing;
    @org.springframework.beans.factory.annotation.Autowired @org.springframework.context.annotation.Lazy
    private QuestionRepository questions;

    private record CachedIds(Set<String> ids, long at) {}
    private final ConcurrentHashMap<String, CachedIds> previewIds = new ConcurrentHashMap<>();
    private static final long PREVIEW_CACHE_MS = 10 * 60_000L;

    public AccessService(@Value("${app.free-techs:}") String csv,
                         @Value("${app.access.teasers:}") String teaserCsv,
                         @Value("${app.access.free-problem-companies:}") String problemCompaniesCsv) {
        this.freeTechs = Arrays.stream(csv.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        Map<String, Teaser> t = new LinkedHashMap<>();
        for (String part : teaserCsv.split(",")) {
            String[] kv = part.trim().split(":");
            if (kv.length != 2) continue;
            String tech = kv[0].trim().toLowerCase(Locale.ROOT), v = kv[1].trim();
            try {
                t.put(tech, v.endsWith("%") ? new Teaser(0, Double.parseDouble(v.substring(0, v.length() - 1)) / 100.0) : new Teaser(Integer.parseInt(v), 0));
            } catch (NumberFormatException ignored) { /* a malformed entry just means no preview rule for that topic */ }
        }
        this.teasers = Map.copyOf(t);
        this.freeProblemCompanyNames = Arrays.stream(problemCompaniesCsv.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
        this.freeProblemCompanies = freeProblemCompanyNames.stream().map(x -> x.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }

    /** True for a signed-in Premium member or an admin. */
    public boolean isPremiumCaller() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return isAuthenticated() && billing != null && billing.isPremium(a.getName());
    }

    /** Topics that have a free preview, with how much of each is free (for the UI's "5 free" hints). */
    public Map<String, String> previewSummary() {
        Map<String, String> m = new LinkedHashMap<>();
        teasers.forEach((tech, t) -> m.put(tech, t.share() > 0 ? Math.round(t.share() * 100) + "%" : String.valueOf(t.count())));
        return m;
    }

    /** The ids a non-Premium reader may open in a preview topic; null when the topic has no preview rule (it is then not limited). */
    public Set<String> previewIdsFor(String tech) {
        if (tech == null) return null;
        Teaser t = teasers.get(tech.toLowerCase(Locale.ROOT));
        if (t == null || questions == null) return null;
        CachedIds c = previewIds.get(tech);
        if (c != null && System.currentTimeMillis() - c.at() < PREVIEW_CACHE_MS) return c.ids();
        List<String> all = questions.idsByTech(tech);
        Set<String> free = all.stream().limit(t.freeOf(all.size())).collect(Collectors.toUnmodifiableSet());
        previewIds.put(tech, new CachedIds(free, System.currentTimeMillis()));
        return free;
    }

    /** Is this question's answer behind Premium for this caller? Only a preview topic's later questions are, and never for Premium members. */
    public boolean isLocked(Question q, boolean premium) {
        if (premium) return false;
        Set<String> free = previewIdsFor(q.getTech());
        return free != null && !free.contains(q.getId());
    }

    /** The question as this caller may see it: unchanged, or a locked copy without the answer. */
    public Question mask(Question q, boolean premium) {
        return isLocked(q, premium) ? q.lockedCopy() : q;
    }

    /** Readable by every visitor, signed in or not (used to pick the question of the day, which must open for everyone). */
    public boolean isOpenToAll(String id, String tech) {
        Set<String> free = previewIdsFor(tech);
        return free == null || free.contains(id);
    }

    /** Company-wise question filters are a Premium feature. */
    public boolean companyFilterAllowed(boolean premium) {
        return premium;
    }

    /** Coding problems stay free; only these companies can be used as a filter without Premium. */
    public boolean isFreeProblemCompany(String name) {
        return name != null && freeProblemCompanies.contains(name.trim().toLowerCase(Locale.ROOT));
    }

    public List<String> freeProblemCompanies() {
        return freeProblemCompanyNames;
    }

    /** True when the caller presented a valid token. */
    public boolean isAuthenticated() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null
                && a.isAuthenticated()
                && a.getName() != null
                && !"anonymousUser".equals(a.getName());
    }

    /** Signed-out callers are limited to the free topics. */
    public boolean isRestricted() {
        return !isAuthenticated();
    }

    public List<String> allowedTechs() {
        // Never return an empty list: an empty IN (...) is invalid in some dialects.
        return freeTechs.isEmpty() ? List.of("__none__") : List.copyOf(freeTechs);
    }

    public Set<String> freeTechs() {
        return freeTechs;
    }

    /** Can the caller read a question of this topic? */
    public boolean canRead(String tech) {
        return isAuthenticated() || (tech != null && freeTechs.contains(tech.toLowerCase()));
    }
}
