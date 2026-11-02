package com.interview.backend.practice;

import java.util.List;

/**
 * What a strong answer to one system design question covers, stage by stage.
 * source: "manual" (hand-written or edited in Admin) or "auto" (drafted from the model answer).
 */
public record Rubric(String source, List<Stage> stages) {
    public record Stage(String key, String label, double weight, List<Concept> concepts) {}

    /** A point the answer should make; any one of its terms (synonyms) counts. */
    public record Concept(String name, List<String> terms) {}
}
