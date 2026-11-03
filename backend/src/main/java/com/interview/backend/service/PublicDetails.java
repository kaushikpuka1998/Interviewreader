package com.interview.backend.service;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Validation and tidying for the optional details a member shows on their public profile. Handles are stored on their own (never a
 * free-form URL), so a GitHub or LinkedIn link can only ever point at github.com or linkedin.com; the website must be a plain http(s)
 * address. Everything is trimmed, length-limited and stripped of control characters. Invalid input throws IllegalArgumentException
 * with a message fit to show the member.
 */
public final class PublicDetails {

    private static final Pattern GITHUB = Pattern.compile("^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$");
    private static final Pattern LINKEDIN = Pattern.compile("^[A-Za-z0-9_%-]{3,100}$");
    private static final Pattern SKILL = Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N} .+#/&-]{0,23}$");
    public static final int MAX_SKILLS = 8;

    private PublicDetails() {}

    public record Cleaned(String headline, String college, String github, String linkedin, String website, String bio, List<String> skills) {}

    public static Cleaned clean(String headline, String college, String github, String linkedin, String website, String bio, List<String> skills) {
        return new Cleaned(
                text(headline, 120, "Headline"),
                text(college, 120, "College"),
                github(github),
                linkedin(linkedin),
                website(website),
                text(bio, 280, "Description"),
                skills(skills));
    }

    /** Single-line text: control characters dropped, whitespace collapsed, empty becomes null. */
    static String text(String s, int max, String label) {
        if (s == null) return null;
        String t = s.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").strip();
        if (t.isEmpty()) return null;
        if (t.length() > max) throw new IllegalArgumentException(label + " can be at most " + max + " characters.");
        return t;
    }

    /** "octocat", "@octocat", "github.com/octocat" or "https://github.com/octocat/" all become "octocat". */
    static String github(String s) {
        String t = handle(s, "github.com/");
        if (t == null) return null;
        if (!GITHUB.matcher(t).matches() || t.endsWith("-")) throw new IllegalArgumentException("That doesn't look like a GitHub username.");
        return t;
    }

    /** "janedoe", "linkedin.com/in/janedoe" or the full URL all become "janedoe". */
    static String linkedin(String s) {
        String t = handle(s, "linkedin.com/in/");
        if (t == null) return null;
        if (!LINKEDIN.matcher(t).matches()) throw new IllegalArgumentException("That doesn't look like a LinkedIn profile name (the part after linkedin.com/in/).");
        return t;
    }

    private static String handle(String s, String marker) {
        if (s == null) return null;
        String t = s.strip();
        if (t.isEmpty()) return null;
        String low = t.toLowerCase(Locale.ROOT);
        int i = low.indexOf(marker);
        if (i >= 0) t = t.substring(i + marker.length());
        t = t.replaceFirst("^@", "");
        int cut = t.indexOf('/');
        if (cut >= 0) t = t.substring(0, cut);
        cut = t.indexOf('?');
        if (cut >= 0) t = t.substring(0, cut);
        return t.isEmpty() ? null : t;
    }

    /** An http(s) address with a real host. A bare "example.com" gets https:// in front. */
    static String website(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.strip();
        if (!t.matches("(?i)^https?://.*")) {
            if (t.contains("://") || t.toLowerCase(Locale.ROOT).startsWith("javascript:") || t.toLowerCase(Locale.ROOT).startsWith("data:"))
                throw new IllegalArgumentException("The website must start with http:// or https://.");
            t = "https://" + t;
        }
        if (t.length() > 200) throw new IllegalArgumentException("Website can be at most 200 characters.");
        try {
            URI u = new URI(t);
            String host = u.getHost();
            if (host == null || !host.contains(".") || u.getUserInfo() != null) throw new IllegalArgumentException("That doesn't look like a valid website address.");
            return t;
        } catch (java.net.URISyntaxException e) {
            throw new IllegalArgumentException("That doesn't look like a valid website address.");
        }
    }

    /** Up to 8 short tags; blanks and repeats (ignoring case) are dropped. */
    static List<String> skills(List<String> in) {
        List<String> out = new ArrayList<>();
        if (in == null) return out;
        Map<String, Boolean> seen = new LinkedHashMap<>();
        for (String raw : in) {
            String t = raw == null ? "" : raw.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").strip();
            if (t.isEmpty() || seen.putIfAbsent(t.toLowerCase(Locale.ROOT), true) != null) continue;
            if (!SKILL.matcher(t).matches()) throw new IllegalArgumentException("Skill \"" + t + "\" has unsupported characters or is longer than 24 characters.");
            out.add(t);
        }
        if (out.size() > MAX_SKILLS) throw new IllegalArgumentException("Add at most " + MAX_SKILLS + " skills.");
        return out;
    }

    /** What a visitor sees: only the fields that are filled in; null when there is nothing to show. */
    public static Map<String, Object> view(String headline, String college, String github, String linkedin, String website, String bio, String skillsCsv) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (headline != null && !headline.isBlank()) m.put("headline", headline);
        if (college != null && !college.isBlank()) m.put("college", college);
        if (github != null && !github.isBlank()) m.put("github", github);
        if (linkedin != null && !linkedin.isBlank()) m.put("linkedin", linkedin);
        if (website != null && !website.isBlank()) m.put("website", website);
        if (bio != null && !bio.isBlank()) m.put("bio", bio);
        List<String> sk = skillsCsv == null || skillsCsv.isBlank() ? List.of() : List.of(skillsCsv.split("\\s*,\\s*"));
        if (!sk.isEmpty()) m.put("skills", sk);
        return m.isEmpty() ? null : m;
    }
}
