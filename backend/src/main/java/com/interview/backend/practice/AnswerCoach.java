package com.interview.backend.practice;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Instant feedback on a typed answer to any question: it compares the answer with the question's model answer, point by point.
 * The key points are the bold terms, inline code terms and headings of the model answer. There is no AI model behind it: it reports
 * which key points the answer made and which it missed, so the advice is specific ("add idempotency") and consistent.
 */
public final class AnswerCoach {

    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*\\n]{3,60})\\*\\*");
    private static final Pattern CODE = Pattern.compile("`([^`\\n]{3,40})`");
    private static final Pattern HEADING = Pattern.compile("^#{1,4}\\s+(.+)$");
    private static final Pattern EXAMPLE = Pattern.compile("(?i)\\b(for example|for instance|e\\.g\\.|such as|suppose|imagine|consider|in practice|say you)\\b");
    private static final Pattern TRADE_OFF = Pattern.compile("(?i)\\b(trade-?off|versus|vs\\.?|instead of|downside|drawback|on the other hand|however|at the cost)\\b");
    private static final int MAX_POINTS = 14;
    private static final double FULL_SHARE = 0.75;   // covering 75% of the marked points earns the top band

    /** basis: "points" (the model answer marks its key points) or "terms" (picked from the model answer's own wording). */
    public record Result(double score, int words, int points, String basis, List<String> covered, List<String> missed, List<String> feedback) {}

    private AnswerCoach() {}

    /** The key points of a model answer, most important first (headings and bold terms before code terms). */
    static List<Rubric.Concept> keyPoints(String modelAnswer) {
        LinkedHashMap<String, Rubric.Concept> out = new LinkedHashMap<>();
        boolean inFence = false;
        for (String line : (modelAnswer == null ? "" : modelAnswer).split("\\n")) {
            String t = line.trim();
            if (t.startsWith("```")) { inFence = !inFence; continue; }
            if (inFence) continue;
            Matcher h = HEADING.matcher(t);
            if (h.matches()) add(out, h.group(1).replaceAll("[*`]", ""), false);
            Matcher b = BOLD.matcher(line);
            while (b.find()) add(out, b.group(1), false);
        }
        Matcher c = CODE.matcher(modelAnswer == null ? "" : modelAnswer);
        while (c.find() && out.size() < MAX_POINTS) add(out, c.group(1), true);
        List<Rubric.Concept> list = new ArrayList<>(out.values());
        return list.size() > MAX_POINTS ? list.subList(0, MAX_POINTS) : list;
    }

    private static final Set<String> COMMON = Set.of("that", "this", "with", "from", "have", "been", "will", "does", "into", "also", "more", "most", "like", "such", "than",
            "then", "them", "they", "their", "there", "these", "those", "when", "what", "which", "while", "where", "whose", "would", "could", "should", "about", "above", "after",
            "again", "because", "before", "being", "between", "both", "each", "every", "other", "only", "same", "some", "very", "your", "you", "are", "was", "were", "can", "may",
            "might", "must", "not", "but", "for", "and", "the", "its", "use", "used", "uses", "using", "usually", "often", "any", "all", "one", "two", "via", "per", "own", "way",
            "make", "makes", "made", "need", "needs", "give", "gives", "take", "takes", "get", "gets", "set", "sets", "know", "see", "think", "here", "just", "even", "still",
            "many", "much", "multiple", "several", "single", "various", "allows", "allow", "less", "least", "well", "good", "best", "better", "long", "high", "low", "new", "old", "different", "difference", "example", "examples", "ideally");
    private static final Pattern WORD = Pattern.compile("[A-Za-z][A-Za-z0-9]*(?:[-_.][A-Za-z0-9]+)*");

    /** For answers with no marked points: the most telling words of the model answer's prose (not its code), as terms to use. */
    static List<Rubric.Concept> prose(String modelAnswer, Set<String> already) {
        Map<String, Integer> freq = new LinkedHashMap<>();
        Map<String, String> shown = new HashMap<>();
        boolean inFence = false;
        for (String line : (modelAnswer == null ? "" : modelAnswer).split("\\n")) {
            String t = line.trim();
            if (t.startsWith("```")) { inFence = !inFence; continue; }
            if (inFence || t.startsWith("|---") || t.startsWith("//")) continue;
            Matcher m = WORD.matcher(t);
            while (m.find()) {
                String w = m.group();
                String k = w.toLowerCase(Locale.ROOT);
                if (k.length() < 4 || COMMON.contains(k) || DesignScorer.normalise(k).length() < 4) continue;
                freq.merge(k, 1, Integer::sum);
                shown.putIfAbsent(k, w);
            }
        }
        List<Map.Entry<String, Integer>> ranked = new ArrayList<>(freq.entrySet());
        ranked.sort((a, b) -> Double.compare(rank(b.getKey(), b.getValue(), shown), rank(a.getKey(), a.getValue(), shown)));
        List<Rubric.Concept> out = new ArrayList<>();
        for (var e : ranked) {
            String term = shown.get(e.getKey());
            if (already.contains(DesignScorer.normalise(term))) continue;
            List<String> alts = new ArrayList<>(RubricDrafter.termsFor(term));
            if (term.toLowerCase(Locale.ROOT).startsWith("non-")) { alts.add("not " + term.substring(4)); alts.add("isn't " + term.substring(4)); }
            out.add(new Rubric.Concept(term, alts));
            if (out.size() >= 8) break;
        }
        return out;
    }

    // Repeated words, hyphenated or technical-looking ones (non-synchronized, HashMap, thread-safe) and longer words rank first.
    private static double rank(String k, int n, Map<String, String> shown) {
        String w = shown.get(k);
        return n + (k.length() >= 8 ? 1 : 0) + (k.contains("-") || k.contains("_") || k.contains(".") ? 1.5 : 0) + (w.chars().skip(1).anyMatch(Character::isUpperCase) ? 1.5 : 0);
    }

    private static void add(Map<String, Rubric.Concept> out, String raw, boolean code) {
        String term = raw.replaceAll("[:.,;]+$", "").trim();
        if (code && (term.contains("(") || term.contains("=") || term.contains(";") || term.contains("{") || term.split("\\s+").length > 3)) return;
        String key = DesignScorer.normalise(term);
        if (key.length() < 3 || key.split(" ").length > 5 || RubricDrafter.isNotAConcept(term)) return;
        if (!key.contains(" ") && !specificWord(term, key)) return;   // a lone bold word like "Model" or "Log" is a table header, not a point to make
        out.putIfAbsent(key, new Rubric.Concept(term, RubricDrafter.termsFor(term)));
    }

    private static final Set<String> GENERIC = Set.of("model", "usage", "case", "cases", "feature", "features", "aspect", "difference", "differences", "comparison", "approach",
            "summary", "overview", "conclusion", "definition", "purpose", "benefits", "drawbacks", "details", "description", "result", "results", "problem", "solution",
            "advantages", "disadvantages", "pros", "cons", "notes", "tools", "types", "steps", "answer", "question", "when", "which", "example", "examples", "important");

    // A single word counts only when it is clearly a technical term: an acronym, something with digits or symbols (HashMap, Node.js), or a long enough non-generic word.
    private static boolean specificWord(String term, String key) {
        boolean acronym = term.length() >= 2 && term.equals(term.toUpperCase(Locale.ROOT)) && term.chars().anyMatch(Character::isLetter);
        boolean technical = term.chars().anyMatch(ch -> Character.isDigit(ch) || ch == '.' || ch == '@' || ch == '_' || ch == '-') || term.chars().skip(1).anyMatch(Character::isUpperCase);
        return acronym || technical || (key.length() >= 6 && !GENERIC.contains(key));
    }

    public static Result coach(String modelAnswer, String answer) {
        List<Rubric.Concept> points = new ArrayList<>(keyPoints(modelAnswer));
        String text = answer == null ? "" : answer;
        int words = text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
        String basis = "points";
        if (points.size() < 4) {
            // The model answer does not mark its key points (most short answers): use its own wording instead, from its prose.
            Set<String> have = new HashSet<>();
            for (var c : points) have.add(DesignScorer.normalise(c.name()));
            points.addAll(prose(modelAnswer, have));
            basis = "terms";
        }
        if (points.size() < 3) {
            return new Result(words >= 40 ? 6.0 : 3.0, words, 0, "none", List.of(), List.of(),
                    List.of("This answer is too short to check point by point. Compare yours with the model answer."));
        }
        var scored = DesignScorer.score(new Rubric("auto", List.of(new Rubric.Stage("points", "Key points", 1.0, points))), text);
        var stage = scored.stages().get(0);
        // Wording from prose is a looser test than marked points (a good answer can say it differently), so fewer matches earn full marks.
        int need = Math.max(1, (int) Math.ceil(("terms".equals(basis) ? 0.7 : FULL_SHARE) * points.size()));
        double score = 10.0 * Math.min(1.0, stage.covered().size() / (double) need);
        if (!stage.missed().isEmpty()) score = Math.min(score, 9.0);   // 10 is for an answer that missed nothing
        if (words < 15) score = Math.min(score, 2.0); else if (words < 25) score = Math.min(score, 5.0);
        score = Math.round(score * 10) / 10.0;

        List<String> feedback = new ArrayList<>();
        if (score >= 8) feedback.add("Strong answer: you covered the main points.");
        else if (score >= 5) feedback.add("A decent start. A few key points are missing.");
        else feedback.add("This misses most of the key points.");
        if ("terms".equals(basis)) {
            if (!stage.missed().isEmpty()) feedback.add("Try to cover: " + String.join(", ", stage.missed().stream().limit(4).toList()) + ".");
        } else for (String m : stage.missed().stream().limit(3).toList()) feedback.add("Mention " + m + ": what it is and why it matters here.");
        if (words < 25) feedback.add("Your answer is short (" + words + " words). Explain the idea in a few sentences, not a line.");
        if (!EXAMPLE.matcher(text).find() && words >= 15) feedback.add("Add a concrete example, such as a real situation where you would use it.");
        if (!TRADE_OFF.matcher(text).find() && words >= 40 && score >= 5) feedback.add("Mention a trade-off or a downside: interviewers listen for it.");
        return new Result(score, words, points.size(), basis, stage.covered(), stage.missed(), feedback);
    }
}
