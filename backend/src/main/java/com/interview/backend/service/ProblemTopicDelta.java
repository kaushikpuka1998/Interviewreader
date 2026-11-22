package com.interview.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.CodingProblem;
import com.interview.backend.repository.CodingProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * On startup, applies problem-topics-delta.json: {title: {from, to}}. A problem is changed only while its topics still
 * equal "from", so the run is repeatable and a later admin edit is never overwritten.
 */
@Slf4j
@Component
@Order(100)   // after ProblemTopicBackfill has filled any missing topics
@RequiredArgsConstructor
public class ProblemTopicDelta implements CommandLineRunner {

    private final CodingProblemRepository problems;

    record Change(String from, String to) {}

    @Override
    public void run(String... args) throws Exception {
        Map<String, Change> delta;
        try (InputStream in = new ClassPathResource("problem-topics-delta.json").getInputStream()) {
            delta = new ObjectMapper().readValue(in, new TypeReference<>() {});
        }
        List<CodingProblem> changed = new ArrayList<>();
        for (CodingProblem p : problems.findAll()) {
            Change c = delta.get(p.getTitle());
            if (c != null && c.from().equals(p.getTopics())) { p.setTopics(c.to()); changed.add(p); }
        }
        if (!changed.isEmpty()) { problems.saveAll(changed); log.info("Topic delta applied to {} coding problems", changed.size()); }
    }
}
