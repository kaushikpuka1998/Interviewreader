package com.interview.backend.service;

import com.interview.backend.entity.CompanySalary;
import com.interview.backend.repository.CompanySalaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/** The Salaries pages' data: every company with its levels (lowest pay first), cached for ten minutes. */
@Service
@RequiredArgsConstructor
public class SalaryService {

    public record Level(String level, String norm, String yoe, String lpa, long inr) {}
    public record Company(String slug, String name, String segment, String median, String min, String max, List<Level> levels) {}
    public record Data(List<Company> companies, List<String> segments, long at) {}

    private final CompanySalaryRepository salaries;
    private volatile Data data;

    public Data all() {
        Data d = data;
        if (d != null && System.currentTimeMillis() - d.at() < 600_000) return d;
        Map<String, List<CompanySalary>> by = new LinkedHashMap<>();
        for (var e : salaries.findAllByOrderByIdAsc()) by.computeIfAbsent(e.getCompanySlug(), k -> new ArrayList<>()).add(e);
        var companies = new ArrayList<Company>();
        var segments = new TreeSet<String>();
        for (var rows : by.values()) {
            rows.sort(Comparator.comparingLong(CompanySalary::getInr));
            var first = rows.get(0);
            var last = rows.get(rows.size() - 1);
            String segment = rows.stream().map(CompanySalary::getSegment).filter(x -> x != null && !x.isBlank()).findFirst().orElse("");
            if (!segment.isEmpty()) segments.add(segment);
            String median = rows.stream().map(CompanySalary::getCompanyMedian).filter(x -> x != null && !x.isBlank()).findFirst().orElse("");
            companies.add(new Company(first.getCompanySlug(), first.getCompany(), segment, median, first.getLpa(), last.getLpa(),
                    rows.stream().map(r -> new Level(r.getLevel(), r.getNorm(), r.getYoe(), r.getLpa(), r.getInr())).toList()));
        }
        companies.sort(Comparator.comparing(c -> c.name().toLowerCase()));
        return data = new Data(companies, List.copyOf(segments), System.currentTimeMillis());
    }

    public Company company(String slug) {
        return all().companies().stream().filter(c -> c.slug().equals(slug)).findFirst().orElse(null);
    }
}
