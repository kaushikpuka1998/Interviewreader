package com.interview.backend.service;

import com.interview.backend.entity.CompanySalary;
import com.interview.backend.repository.CompanySalaryRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SalaryTest {

    private static CompanySalary row(String company, String level, long inr, String lpa, String median) {
        var e = new CompanySalary();
        e.setRowKey(SalarySeed.slug(company) + "|" + SalarySeed.slug(level));
        e.setCompany(company);
        e.setCompanySlug(SalarySeed.slug(company));
        e.setSegment("MNC / Big Tech");
        e.setLevel(level);
        e.setNorm("SDE-2");
        e.setYoe("4-5 years");
        e.setInr(inr);
        e.setLpa(lpa);
        e.setCompanyMedian(median);
        return e;
    }

    @Test
    void loadsTheWholeFileOnFirstStartAndNothingOnTheSecond() {
        var repo = mock(CompanySalaryRepository.class);
        when(repo.findAll()).thenReturn(List.of());
        new SalarySeed(repo).run();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CompanySalary>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(saved.capture());
        var rows = saved.getValue();
        assertEquals(1105, rows.size());
        assertEquals(1105, rows.stream().map(CompanySalary::getRowKey).distinct().count());   // no two lines share a key
        assertEquals(390, rows.stream().map(CompanySalary::getCompanySlug).distinct().count());

        // a restart with the same file: every row is already stored (the database gave each an id) and equal, so nothing is written or removed
        long id = 1;
        for (var r : rows) r.setId(id++);
        var again = mock(CompanySalaryRepository.class);
        when(again.findAll()).thenReturn(new ArrayList<>(rows));
        new SalarySeed(again).run();
        verify(again, never()).saveAll(any());
        verify(again, never()).deleteAll(any());
    }

    @Test
    void removesRowsThatLeftTheFile() {
        var repo = mock(CompanySalaryRepository.class);
        var gone = row("Defunct Co", "L1", 1_000_000, "10", "");
        when(repo.findAll()).thenReturn(List.of(gone));
        new SalarySeed(repo).run();
        verify(repo).deleteAll(List.of(gone));
    }

    @Test
    void doesNotKeepAnEmptyAnswerOnceTheSeedHasFinished() {
        var repo = mock(CompanySalaryRepository.class);
        when(repo.findAllByOrderByIdAsc()).thenReturn(List.of(), List.of(row("Acme", "L3", 2_000_000, "20", "")));
        var service = new SalaryService(repo);
        assertTrue(service.all().companies().isEmpty());     // asked before the seed finished
        assertEquals(1, service.all().companies().size());   // asked again after: not stuck on the empty answer
        service.all();
        verify(repo, times(2)).findAllByOrderByIdAsc();      // and a real answer is cached
    }

    @Test
    void groupsLevelsPerCompanyLowestPayFirst() {
        var repo = mock(CompanySalaryRepository.class);
        when(repo.findAllByOrderByIdAsc()).thenReturn(List.of(
                row("Acme", "L5", 6_000_000, "60", "35"), row("Acme", "L3", 2_000_000, "20", "35"), row("Zed", "All levels", 1_500_000, "15", "")));
        var data = new SalaryService(repo).all();
        assertEquals(List.of("Acme", "Zed"), data.companies().stream().map(SalaryService.Company::name).toList());
        var acme = data.companies().get(0);
        assertEquals("20", acme.min());
        assertEquals("60", acme.max());
        assertEquals("35", acme.median());
        assertEquals(List.of("L3", "L5"), acme.levels().stream().map(SalaryService.Level::level).toList());
        assertEquals(List.of("MNC / Big Tech"), data.segments());
        assertNotNull(new SalaryService(repo).company("zed"));
        assertNull(new SalaryService(repo).company("nobody"));
    }
}
