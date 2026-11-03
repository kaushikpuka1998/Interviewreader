package com.interview.backend.service;

import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * The daily pair: a question to read and a coding problem to solve. The question is from a different topic each day, the same for everyone, changing at midnight India time. Picked by the date, so it needs
 * no storage and every server instance agrees.
 */
@Service
@RequiredArgsConstructor
public class DailyQuestionService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final QuestionRepository questions;
    private final CodingProblemRepository problems;

    private volatile LocalDate cachedDay;
    private volatile Map<String, Object> cached;

    public Map<String, Object> today() {
        LocalDate day = LocalDate.now(ZONE);
        if (day.equals(cachedDay) && cached != null) return cached;
        // A different topic each day (the date picks the topic, then a question in it); only members open it, so any topic will do.
        var byTech = new java.util.TreeMap<String, List<Object[]>>();
        for (Object[] r : questions.idTitlesTechs()) byTech.computeIfAbsent((String) r[2], k -> new java.util.ArrayList<>()).add(r);
        if (byTech.isEmpty()) return Map.of();
        var techs = new java.util.ArrayList<>(byTech.values());
        long n = day.toEpochDay();
        List<Object[]> pool = techs.get((int) Math.floorMod(n, (long) techs.size()));
        Object[] pick = pool.get((int) Math.floorMod(n / techs.size() * 7919, (long) pool.size()));
        Map<String, Object> out = new java.util.LinkedHashMap<>(Map.of("date", day.toString(), "id", pick[0], "title", pick[1],
                "slug", ShareSlug.of((String) pick[1])));
        // The problem is a Basic or Intermediate one (a daily habit shouldn't start with a Hard), picked by date like the question.
        var pool2 = problems.findSummariesByOrderByIdAsc().stream()
                .filter(p -> "Basic".equalsIgnoreCase(p.getDifficulty()) || "Intermediate".equalsIgnoreCase(p.getDifficulty())).toList();
        if (!pool2.isEmpty()) {
            var p = pool2.get((int) Math.floorMod(day.toEpochDay() * 104729, (long) pool2.size()));
            out.put("problem", Map.of("id", p.getId(), "title", p.getTitle(), "difficulty", p.getDifficulty()));
        }
        cached = out;
        cachedDay = day;
        return out;
    }
}
