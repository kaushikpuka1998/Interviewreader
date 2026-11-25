package com.interview.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.CompanySalary;
import com.interview.backend.repository.CompanySalaryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * On startup, makes the company_salaries table match company-salaries.json (built by scripts/gen-company-salaries.py): rows that are new
 * are added, changed ones are updated and ones no longer in the file are removed. It is reference data, not user content, so the file
 * is the source of truth and restarting with the same file changes nothing.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SalarySeed implements CommandLineRunner {

    private final CompanySalaryRepository salaries;

    static String slug(String s) { return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", ""); }

    /** Key of each line: company and level, plus the repeat number when the same pair appears twice in the file. */
    static List<String> keys(List<Map<String, Object>> rows) {
        var seen = new HashMap<String, Integer>();
        var out = new ArrayList<String>();
        for (var r : rows) {
            String key = slug((String) r.get("company")) + "|" + slug((String) r.get("level"));
            int n = seen.merge(key, 1, Integer::sum);
            out.add(n > 1 ? key + "|" + n : key);
        }
        return out;
    }

    private static String s(Object o) { return o == null ? "" : o.toString(); }

    @Override
    public void run(String... args) {
        List<Map<String, Object>> rows;
        try (InputStream in = new ClassPathResource("company-salaries.json").getInputStream()) {
            rows = new ObjectMapper().readValue(in, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("company-salaries.json could not be read: {}", e.getMessage());
            return;
        }
        var keys = keys(rows);
        var stored = new HashMap<String, CompanySalary>();
        for (var e : salaries.findAll()) stored.put(e.getRowKey(), e);
        var save = new ArrayList<CompanySalary>();
        for (int i = 0; i < rows.size(); i++) {
            var r = rows.get(i);
            var e = stored.getOrDefault(keys.get(i), new CompanySalary());
            boolean fresh = e.getId() == null;
            if (!fresh && same(e, r)) continue;
            e.setRowKey(keys.get(i));
            e.setCompany(s(r.get("company")));
            e.setCompanySlug(slug(s(r.get("company"))));
            e.setSegment(s(r.get("segment")));
            e.setLevel(s(r.get("level")));
            e.setNorm(s(r.get("norm")));
            e.setYoe(s(r.get("yoe")));
            e.setInr(((Number) r.get("inr")).longValue());
            e.setLpa(s(r.get("lpa")));
            e.setCompanyMedian(s(r.get("median")));
            save.add(e);
        }
        var current = new HashSet<>(keys);
        var gone = stored.values().stream().filter(e -> !current.contains(e.getRowKey())).toList();
        if (!gone.isEmpty()) salaries.deleteAll(gone);
        if (!save.isEmpty()) salaries.saveAll(save);
        if (!save.isEmpty() || !gone.isEmpty()) log.info("Company salaries: {} added or updated, {} removed", save.size(), gone.size());
    }

    private static boolean same(CompanySalary e, Map<String, Object> r) {
        return Objects.equals(e.getSegment(), s(r.get("segment"))) && Objects.equals(e.getLevel(), s(r.get("level")))
                && Objects.equals(e.getNorm(), s(r.get("norm"))) && Objects.equals(e.getYoe(), s(r.get("yoe")))
                && e.getInr() == ((Number) r.get("inr")).longValue() && Objects.equals(e.getLpa(), s(r.get("lpa")))
                && Objects.equals(e.getCompanyMedian(), s(r.get("median")));
    }
}
