package com.interview.backend.controller;

import com.interview.backend.service.DailyQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Public: today's question (id, title, slug). The page fetches the answer through the normal question API. */
@RestController
@RequestMapping("/public/qotd")
@RequiredArgsConstructor
public class DailyController {
    private final DailyQuestionService daily;

    @GetMapping
    public Map<String, Object> today() {
        return daily.today();
    }
}
