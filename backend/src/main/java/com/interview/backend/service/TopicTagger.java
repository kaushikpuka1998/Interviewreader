package com.interview.backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Guesses a coding problem's topics from its title, statement and input format. A problem can have several.
 * It is keyword based, so it is approximate: admins can correct the topics on the problem afterwards.
 */
public final class TopicTagger {

    private TopicTagger() {}

    private static final Map<String, Pattern> RULES = new LinkedHashMap<>();

    private static void rule(String topic, String regex) {
        RULES.put(topic, Pattern.compile(regex));
    }

    static {
        rule("Linked List", "linked list|listnode|\\bsingly|\\bdoubly");
        rule("Binary Search Tree", "binary search tree|\\bbst\\b");
        rule("Tree", "binary tree|\\btrees?\\b|treenode|\\btrie\\b|\\bleaf\\b|\\bancestor");
        rule("Graph Theory", "\\bgraph|vertex|vertices|\\bedges?\\b|adjacen(cy|t nodes? in)|shortest path|topological|connected component|\\bdirected\\b|\\bundirected\\b");
        rule("Stack", "\\bstack|parenthes|bracket|monotonic");
        rule("Queue", "\\bqueue|\\bdeque");
        rule("Heap (Priority Queue)", "\\bheap|priority queue|k-?th (largest|smallest)");
        rule("Hash Table", "hash|frequenc|anagram|\\bdistinct\\b|duplicate|\\bunique\\b|\\bcounts? of each");
        rule("String", "\\bstrings?\\b|substring|palindrom|\\bcharacters?\\b|\\bletters?\\b|\\bwords?\\b|\\bvowels?\\b|\\btext\\b|\\bprefix|\\bsuffix");
        rule("Array", "\\barrays?\\b|subarray|\\bnums\\b");
        rule("Matrix", "matrix|\\bgrid\\b|\\bboard\\b|\\brows?\\b.*\\bcolumns?\\b");
        rule("Sorting", "\\bsort|ascending|descending|\\binversions?\\b|\\bmerge sort|\\bquick");
        rule("Binary Search", "binary search|\\bsorted\\b.*\\b(find|search)|\\blower bound|\\bupper bound");
        rule("Two Pointers", "two pointers?|\\bpalindrom|\\bin[ -]place\\b|\\bfrom both ends|\\btwo ends\\b");
        rule("Sliding Window", "sliding window|\\bwindow\\b|contiguous|subarray");
        rule("Dynamic Programming", "dynamic programming|number of ways|\\bways to\\b|longest common|knapsack|fibonacci|climb|coin|subsequence|minimum cost|maximum profit|\\bmemo|\\bdp\\b|edit distance");
        rule("Recursion", "recurs");
        rule("Backtracking", "permutation|combination|subsets?\\b|n-queens|backtrack|\\bgenerate all\\b");
        rule("Math", "\\bprime|\\bgcd\\b|\\blcm\\b|greatest common|factorial|\\bdigits?\\b|divisor|\\bmodulo\\b|\\bremainder|\\bpower\\b|perfect|\\bsquare root|\\bfactors?\\b|\\bsum of (its |the )?digits|\\bis (even|odd)\\b");
        rule("Bit Manipulation", "\\bbits?\\b|\\bxor\\b|bitwise|\\bset bits|binary representation");
        rule("Greedy", "greedy|\\bintervals?\\b|\\bschedul|\\bminimum number of\\b");
    }

    /** Topics for a problem, comma separated, never empty (a problem that matches nothing is filed under Math). */
    public static String infer(String title, String statement) {
        String stmt = statement == null ? "" : statement;
        int fmtAt = stmt.indexOf("**Input format");
        String body = (fmtAt < 0 ? stmt : stmt.substring(0, fmtAt));
        String text = ((title == null ? "" : title) + " . " + body).toLowerCase();
        String fmt = "";
        if (fmtAt >= 0) {
            fmt = stmt.substring(fmtAt);
            int out = fmt.indexOf("**Output format");
            if (out >= 0) fmt = fmt.substring(0, out);
            fmt = fmt.toLowerCase();
        }
        List<String> topics = new ArrayList<>();
        for (Map.Entry<String, Pattern> r : RULES.entrySet()) {
            if (r.getValue().matcher(text).find()) topics.add(r.getKey());
        }
        // Parameter shapes in the input format are a reliable structural hint.
        if (!topics.contains("Array") && fmt.contains("the number of values, then the values")
                && !topics.contains("Matrix") && !topics.contains("Linked List")) topics.add("Array");
        if (!topics.contains("String") && fmt.contains("the text for")) topics.add("String");
        if (!topics.contains("Linked List") && fmt.contains("linked list")) topics.add("Linked List");
        if (!topics.contains("Tree") && (fmt.contains("binary tree") || fmt.contains("tree for"))) topics.add("Tree");
        if (topics.contains("Binary Search Tree") && !topics.contains("Tree")) topics.add("Tree");
        if (topics.isEmpty()) topics.add("Math");
        return String.join(",", topics);
    }

    /** Cleans an admin's comma separated list: trimmed, de-duplicated, no empty entries. Null when nothing is left. */
    public static String normalize(String csv) {
        if (csv == null) return null;
        List<String> out = new ArrayList<>();
        for (String t : csv.split(",")) {
            String s = t.trim();
            if (!s.isEmpty() && out.stream().noneMatch(x -> x.equalsIgnoreCase(s))) out.add(s);
        }
        return out.isEmpty() ? null : String.join(",", out);
    }
}
