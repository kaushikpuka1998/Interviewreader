package com.interview.backend.controller;

import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.LeagueService;
import com.interview.backend.service.LeagueService.Standing;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Public weekly leaderboard. Anyone can view it; "me" is filled in only for a signed-in member. */
@RestController
@RequestMapping("/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeagueService leagues;
    private final UserRepository users;

    @GetMapping
    public Map<String, Object> board() {
        List<Standing> board = leagues.board();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windowDays", LeagueService.WINDOW_DAYS);
        out.put("rules", java.util.Map.of("login", com.interview.backend.service.PointsService.LOGIN, "read", com.interview.backend.service.PointsService.READ,
                "solve", com.interview.backend.service.PointsService.SOLVE, "milestones", com.interview.backend.service.PointsService.MILESTONES));
        out.put("leagues", LeagueService.TIERS.stream()
                .map(t -> Map.of("name", t.getKey(), "minXp", t.getValue())).toList());
        out.put("board", board.stream().map(s -> Map.of(
                "rank", s.rank(), "userId", s.userId(), "username", s.username(), "name", s.name(),
                "xp", s.xp(), "league", s.league())).toList());

        User me = currentUser();
        if (me == null) {
            out.put("me", null);
        } else {
            long xp = leagues.weeklyXp(me.getId());
            Integer rank = board.stream().filter(s -> s.userId() == me.getId())
                    .map(Standing::rank).findFirst().orElse(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", rank);            // null = outside the top 100, no reads this week, or no location yet
            m.put("xp", xp);
            m.put("league", LeagueService.league(xp));
            m.put("needsLocation", !LeagueService.hasLocation(me));
            out.put("me", m);
        }
        return out;
    }

    private User currentUser() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || a.getName() == null || "anonymousUser".equals(a.getName())) return null;
        return users.findByEmail(a.getName()).orElse(null);
    }
}
