package com.interview.backend.practice;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Scores a system design answer against a rubric, out of 10, by coverage: which expected points it makes, stage by stage.
 * No AI: it can't judge whether a statement is correct, only whether the ground a strong answer covers is covered.
 * Pure and stateless, so it is unit-tested directly.
 */
public final class DesignScorer {

    /** Share of a stage's concepts that earns the full stage score: a strong answer rarely names every single one. */
    static final double FULL_STAGE_SHARE = 0.6;
    /** Below these word counts the score is capped: a few lines can't be a full design. */
    static final int SHORT_WORDS = 120, VERY_SHORT_WORDS = 60;

    // Ordinary words that real sentences have and keyword dumps ("redis kafka cdn sharding") don't.
    private static final Set<String> FUNCTION_WORDS = Set.of(
            "the", "a", "an", "to", "of", "and", "or", "is", "are", "be", "for", "with", "we", "it", "this", "that", "in",
            "on", "by", "so", "if", "then", "can", "will", "would", "should", "use", "using", "because", "which", "each",
            "when", "as", "from", "into", "our", "they", "their", "i", "you", "need", "have", "has", "not", "but", "per", "at");

    private static final Pattern SENTENCE_SPLIT = Pattern.compile("[.!?;\\n]+");
    private static final Pattern NUMBERS = Pattern.compile(
            "\\b\\d+(\\.\\d+)?\\s*(k|m|b|million|billion|thousand|qps|rps|tps|kb|mb|gb|tb|pb|ms|%|percent|per second|requests|users|bytes)\\b");
    private static final Pattern TRADE_OFF = Pattern.compile(
            "\\b(trade ?-?offs?|because|instead of|versus|vs|downside|on the other hand|at the cost of|pros and cons|compared to)\\b");

    public record StageResult(String key, String label, double weight, double score, List<String> covered, List<String> missed) {}

    public record Result(double score, int words, List<StageResult> stages, List<String> feedback) {}

    private DesignScorer() {}

    public static Result score(Rubric rubric, String answer) {
        String text = answer == null ? "" : answer;
        int words = tokens(normalise(text)).size();

        // Only sentences that read like prose can earn concepts.
        List<List<String>> sentences = new ArrayList<>();
        for (String raw : SENTENCE_SPLIT.split(text)) {
            List<String> t = tokens(normalise(raw));
            if (t.size() >= 6 && t.stream().filter(FUNCTION_WORDS::contains).count() >= 2) sentences.add(stem(t));
        }

        String lower = text.toLowerCase(Locale.ROOT);
        boolean hasNumbers = NUMBERS.matcher(lower).find();
        long tradeOffSignals = TRADE_OFF.matcher(lower).results().count();

        List<StageResult> results = new ArrayList<>();
        double weighted = 0, totalWeight = 0;
        for (Rubric.Stage stage : rubric.stages()) {
            List<String> covered = new ArrayList<>(), missed = new ArrayList<>();
            for (Rubric.Concept c : stage.concepts()) (mentioned(c, sentences) ? covered : missed).add(c.name());
            int need = Math.max(1, (int) Math.ceil(FULL_STAGE_SHARE * stage.concepts().size()));
            double s = stage.concepts().isEmpty() ? 0 : Math.min(1.0, covered.size() / (double) need);
            // Concrete numbers count as doing the estimate; repeated trade-off reasoning counts for the trade-off stage.
            if ("estimation".equals(stage.key()) && hasNumbers) s = Math.max(s, 0.5);
            if ("tradeoffs".equals(stage.key()) && tradeOffSignals >= 2) s = Math.max(s, 0.5);
            results.add(new StageResult(stage.key(), stage.label(), stage.weight(), round2(s), covered, missed));
            weighted += stage.weight() * s;
            totalWeight += stage.weight();
        }

        double score = totalWeight == 0 ? 0 : 10 * weighted / totalWeight;
        if (words < VERY_SHORT_WORDS) score = Math.min(score, 2.0);
        else if (words < SHORT_WORDS) score = Math.min(score, 4.0);
        score = Math.round(score * 10) / 10.0;

        return new Result(score, words, results, feedback(results, words, hasNumbers));
    }

    private static List<String> feedback(List<StageResult> stages, int words, boolean hasNumbers) {
        List<String> out = new ArrayList<>();
        List<String> strong = stages.stream().filter(s -> s.score() >= 0.8).map(StageResult::label).toList();
        List<StageResult> weak = stages.stream().filter(s -> s.score() < 0.5).toList();
        if (!strong.isEmpty()) out.add("Strong: " + String.join(", ", strong) + ".");
        for (StageResult s : weak.stream().limit(3).toList()) {
            String examples = String.join(", ", s.missed().stream().limit(3).toList());
            out.add(s.label() + " needs work" + (examples.isEmpty() ? "." : ": cover " + examples + "."));
        }
        if (words < SHORT_WORDS) out.add("The answer is short (" + words + " words). A full round covers each stage in a few sentences.");
        if (!hasNumbers) out.add("Add a capacity estimate with real numbers (requests per second, storage per year).");
        if (out.isEmpty()) out.add("Well-rounded answer. Next time, go deeper on the trickiest component.");
        return out;
    }

    private static boolean mentioned(Rubric.Concept c, List<List<String>> sentences) {
        for (String term : c.terms()) {
            List<String> t = stem(tokens(normalise(term)));
            if (t.isEmpty()) continue;
            for (List<String> s : sentences) if (contains(s, t)) return true;
        }
        return false;
    }

    // Words match exactly, except that the term's last word may be a stem of 5+ letters ("replicat" matches "replication").
    private static boolean contains(List<String> haystack, List<String> needle) {
        int last = needle.size() - 1;
        outer:
        for (int i = 0; i + needle.size() <= haystack.size(); i++) {
            for (int j = 0; j < needle.size(); j++) {
                String h = haystack.get(i + j), n = needle.get(j);
                boolean ok = sameWord(h, n) || (j == last && n.length() >= 5 && h.startsWith(n));
                if (!ok) continue outer;
            }
            return true;
        }
        return false;
    }

    static String normalise(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    static List<String> tokens(String normalised) {
        return normalised.isEmpty() ? List.of() : Arrays.asList(normalised.split(" "));
    }

    // Only "-ies" -> "-y" (policies/policy); other plurals are handled by sameWord.
    static List<String> stem(List<String> tokens) {
        List<String> out = new ArrayList<>(tokens.size());
        for (String t : tokens) out.add(t.length() > 4 && t.endsWith("ies") ? t.substring(0, t.length() - 3) + "y" : t);
        return out;
    }

    // Plurals and simple endings: cache/caches, alias/aliases, database/databases, process/processes.
    // Suffix-stripping rules get English wrong in both directions, so compare by prefix with at most 2 extra letters.
    static boolean sameWord(String a, String b) {
        if (a.equals(b)) return true;
        String shorter = a.length() <= b.length() ? a : b, longer = shorter == a ? b : a;
        return shorter.length() >= 4 && longer.length() - shorter.length() <= 2 && longer.startsWith(shorter);
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
