package com.interview.backend.controller;

import com.interview.backend.service.SalaryService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

/** Public: company-wise software engineer pay in India, with each company's levels (see SalaryService). */
@RestController
public class SalaryController {

    private final SalaryService salaries;

    public SalaryController(SalaryService salaries) { this.salaries = salaries; }

    @GetMapping("/public/salaries")
    public ResponseEntity<?> all() {
        var d = salaries.all();
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(Map.of("companies", d.companies(), "segments", d.segments()));
    }
}
