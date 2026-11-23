package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.*;
import com.interview.backend.service.PointsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** The streak page's history: the checked-in days and the day a Premium streak freeze covered. */
class PointsControllerTest {

    private User me;
    private PointEventRepository events;
    private PointsController controller;

    @BeforeEach
    void setUp() {
        UserRepository users = mock(UserRepository.class);
        events = mock(PointEventRepository.class);
        controller = new PointsController(mock(PointsService.class), users, events, mock(QuestionRepository.class), mock(CodingProblemRepository.class));
        me = new User();
        me.setId(1L);
        me.setEmail("m@example.com");
        when(users.findByEmail("m@example.com")).thenReturn(Optional.of(me));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("m@example.com", "x", List.of()));
    }

    @AfterEach
    void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    void noFreezeMeansNoFrozenDays() {
        assertEquals(List.of(), controller.history().get("frozen"));
    }

    @Test
    void theDayBeforeTheFreezeWasUsedIsReportedAsCovered() {
        LocalDate used = LocalDate.of(2026, 11, 22);
        me.setStreakFreezeUsedOn(used);
        Map<String, Object> h = controller.history();
        assertEquals(List.of("2026-11-21"), h.get("frozen"));
        assertNotNull(h.get("days"));
        assertNotNull(h.get("events"));
    }
}
