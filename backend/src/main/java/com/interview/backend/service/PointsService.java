package com.interview.backend.service;

import com.interview.backend.entity.PointEvent;
import com.interview.backend.entity.User;
import com.interview.backend.repository.PointEventRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Points and the daily streak. Points: +25 for the first sign-in of a day, +50 for the first qualifying read of a
 * question (30 seconds or half the page), +100 for the first accepted solve of a coding problem, and streak milestones
 * (+100 at 7 days, +500 at 30, +2000 at 100). Each award happens once (see PointEvent). The weekly leaderboard and
 * leagues sum the last 7 days of points.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PointsService implements CommandLineRunner {

    public static final int LOGIN = 25, READ = 50, SOLVE = 100;
    /** Streak length in days -> bonus points. */
    public static final Map<Integer, Integer> MILESTONES = Map.of(7, 100, 30, 500, 100, 2000);
    private static final List<Integer> MILESTONE_DAYS = List.of(7, 30, 100);
    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    public static final int WINDOW_DAYS = 7;

    private final PointEventRepository points;
    private final UserRepository users;

    /** Awards points once for (user, kind, ref). Returns true when this call awarded them. */
    public boolean award(Long userId, String kind, String ref, int amount) {
        if (userId == null || ref == null || ref.isBlank()) return false;
        if (points.existsByUserIdAndKindAndRef(userId, kind, ref)) return false;
        PointEvent e = new PointEvent();
        e.setUserId(userId);
        e.setKind(kind);
        e.setRef(ref.length() > 120 ? ref.substring(0, 120) : ref);
        e.setPoints(amount);
        try {
            points.save(e);
            return true;
        } catch (DataIntegrityViolationException race) {
            return false;   // another request awarded it at the same moment
        }
    }

    public void read(Long userId, String questionId) { award(userId, PointEvent.READ, questionId, READ); touchStreak(userId); }

    public void solve(Long userId, Long problemId) { award(userId, PointEvent.SOLVE, String.valueOf(problemId), SOLVE); touchStreak(userId); }

    /**
     * A read or solve proves the member is here today, so count the day for the streak and (once) award the login points. The daily
     * check-in from StreakBadge still runs on page load; this is the back-stop for a member who did the challenge on another device,
     * from the daily page, or before the badge mounted. Idempotent: award() dedupes the login event, and we only touch the date once.
     */
    public synchronized void touchStreak(Long userId) {
        users.findById(userId).ifPresent(this::checkIn);
    }

    /**
     * The day's check-in, on the first signed-in visit of a day (India time): extends the streak if yesterday was
     * counted (else it restarts at 1), awards the login points and any milestone. Repeat calls on the same day do nothing.
     */
    public synchronized Map<String, Object> checkIn(User u) {
        LocalDate today = LocalDate.now(ZONE);
        int bonus = 0;
        String milestone = null;
        if (!today.equals(u.getStreakLastDate())) {
            int streak = today.minusDays(1).equals(u.getStreakLastDate()) && u.getStreakCount() != null ? u.getStreakCount() + 1 : 1;
            u.setStreakCount(streak);
            u.setStreakBest(Math.max(streak, u.getStreakBest() == null ? 0 : u.getStreakBest()));
            u.setStreakLastDate(today);
            users.save(u);
            if (award(u.getId(), PointEvent.LOGIN, today.toString(), LOGIN)) bonus += LOGIN;
            Integer extra = MILESTONES.get(streak);
            if (extra != null && award(u.getId(), PointEvent.STREAK, streak + "@" + today, extra)) {
                bonus += extra;
                milestone = streak + "-day streak";
            }
        }
        Map<String, Object> out = summary(u);
        out.put("awarded", bonus);
        out.put("milestone", milestone);
        return out;
    }

    /** Streak and points for the top bar and profile. A streak whose last day is before yesterday has already ended. */
    public Map<String, Object> summary(User u) {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate last = u.getStreakLastDate();
        boolean alive = last != null && !last.isBefore(today.minusDays(1));
        int streak = alive && u.getStreakCount() != null ? u.getStreakCount() : 0;
        Instant since = Instant.now().minus(WINDOW_DAYS, ChronoUnit.DAYS);
        long week = points.pointsSince(u.getId(), since);
        Map<String, Object> breakdown = new LinkedHashMap<>();
        for (Object[] row : points.breakdownSince(u.getId(), since))
            breakdown.put((String) row[0], Map.of("count", ((Number) row[1]).longValue(), "points", ((Number) row[2]).longValue()));
        Integer next = MILESTONE_DAYS.stream().filter(d -> d > streak).findFirst().orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("streak", streak);
        out.put("best", u.getStreakBest() == null ? 0 : u.getStreakBest());
        out.put("checkedInToday", today.equals(last));
        out.put("weekPoints", week);
        out.put("totalPoints", points.totalPoints(u.getId()));
        out.put("league", LeagueService.league(week));
        out.put("weekBreakdown", breakdown);
        out.put("nextMilestone", next == null ? null : Map.of("days", next, "bonus", MILESTONES.get(next), "daysLeft", next - streak));
        out.put("rules", Map.of("login", LOGIN, "read", READ, "solve", SOLVE));
        out.put("username", u.getUsername());   // for "share my progress" (the public certificate link)
        return out;
    }

    /** First start with points: credit past first reads and first solves, so nobody's standing resets to zero. */
    @Override
    public void run(String... args) {
        try {
            if (points.count() > 0) return;
            int reads = points.backfillReads(READ), solves = points.backfillSolves(SOLVE);
            log.info("Points backfilled from history: {} reads, {} solves", reads, solves);
        } catch (Exception e) {
            log.warn("Points backfill skipped", e);
        }
    }
}
