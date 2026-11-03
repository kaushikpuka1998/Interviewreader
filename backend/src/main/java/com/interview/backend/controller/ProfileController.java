package com.interview.backend.controller;

import com.interview.backend.entity.Question;
import com.interview.backend.entity.User;
import com.interview.backend.entity.UserNote;
import com.interview.backend.entity.UserProgress;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.UserProgressRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import com.interview.backend.service.GeoService;
import com.interview.backend.service.LocationRules;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.function.Predicate;

// Current-user profile: identity + progress. Auth required (locked in SecurityConfig).
// Context-path is already /api, so this maps to /api/profile/*.
@RestController
@RequestMapping("/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final UserProgressRepository progressRepository;
    private final QuestionRepository questionRepository;
    private final com.interview.backend.service.LeagueService leagues;
    private final com.interview.backend.service.UsernameService usernames;
    private final com.interview.backend.repository.UserNoteRepository userNotes;
    private final com.interview.backend.service.BillingService billing;
    private final com.interview.backend.service.ImageService images;

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow();
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        return ResponseEntity.ok(meBody(currentUser()));
    }

    /** Everything the profile page needs in one request: profile, the four lists, and flagged questions. */
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard() {
        User u = currentUser();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("me", meBody(u));
        out.put("solved", questionsFor(UserProgress::isRead));
        out.put("important", questionsFor(UserProgress::isImportant));
        out.put("flagged", questionsFor(UserProgress::isFlagged));
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> meBody(User u) {
        List<UserProgress> rows = liveRows(u.getId());

        List<String> visitedIds = rows.stream().filter(UserProgress::isVisited).map(UserProgress::getQuestionId).toList();
        List<String> solvedIds = rows.stream().filter(UserProgress::isRead).map(UserProgress::getQuestionId).toList();
        List<String> flaggedIds = rows.stream().filter(UserProgress::isFlagged).map(UserProgress::getQuestionId).toList();
        long importantCount = rows.stream().filter(UserProgress::isImportant).count();

        long total = questionRepository.count();

        // Only tech and difficulty are needed for the counts: no answer text is loaded.
        List<Object[]> solvedRows = solvedIds.isEmpty() ? List.of() : questionRepository.techDifficultyByIds(solvedIds);

        // Per-tech breakdown: total questions vs how many this user has solved.
        Map<String, Long> solvedByTech = solvedRows.stream()
                .collect(Collectors.groupingBy(r -> (String) r[1], Collectors.counting()));
        Map<String, Long> totalByTech = questionRepository.countAllByTech().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        List<Map<String, Object>> byTech = new ArrayList<>();
        for (String tech : questionRepository.findDistinctTechs()) {
            byTech.add(Map.of(
                    "tech", tech,
                    "total", totalByTech.getOrDefault(tech, 0L),
                    "solved", solvedByTech.getOrDefault(tech, 0L)));
        }

        // Per-difficulty breakdown (Basic / Intermediate / Advanced / ...).
        Map<String, Long> solvedByDiff = solvedRows.stream()
                .filter(r -> r[2] != null)
                .collect(Collectors.groupingBy(r -> (String) r[2], Collectors.counting()));
        Map<String, Long> totalByDiff = questionRepository.countAllByDifficulty().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        List<Map<String, Object>> byDifficulty = new ArrayList<>();
        for (String diff : questionRepository.findDistinctDifficulties()) {
            byDifficulty.add(Map.of(
                    "difficulty", diff,
                    "total", totalByDiff.getOrDefault(diff, 0L),
                    "solved", solvedByDiff.getOrDefault(diff, 0L)));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", u.getId());
        body.put("username", u.getUsername() == null ? "" : u.getUsername());
        body.put("email", u.getEmail());
        body.put("name", u.getName() == null ? "" : u.getName());
        body.put("details", com.interview.backend.service.PublicDetails.view(u.getHeadline(), u.getCollege(), u.getGithubUser(), u.getLinkedinHandle(), u.getWebsiteUrl(), u.getBio(), u.getSkills()));
        body.put("picture", u.effectivePicture());
        body.put("hasUploadedPicture", u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank());
        body.put("memberSince", u.getCreatedAt());
        body.put("premium", billing.isPremium(u));
        body.put("premiumUntil", u.getPremiumUntil() == null ? "" : u.getPremiumUntil().toString());
        body.put("premiumPlan", u.getPremiumPlan() == null ? "" : u.getPremiumPlan());
        body.put("subscriptionStatus", u.getSubscriptionStatus() == null ? "" : u.getSubscriptionStatus());
        body.put("country", u.getCountry() == null ? "" : u.getCountry());
        body.put("city", u.getCity() == null ? "" : u.getCity());
        body.put("locationSource", u.getLocationSource() == null ? "" : u.getLocationSource());
        // Visited counts per tech and difficulty, for the pie charts (the visited list loads on demand).
        body.put("visitedByTech", progressRepository.visitedByTech(u.getId()).stream()
                .map(r -> Map.of("tech", r[0], "count", ((Number) r[1]).longValue())).toList());
        body.put("visitedByDifficulty", progressRepository.visitedByDifficulty(u.getId()).stream()
                .map(r -> Map.of("difficulty", r[0], "count", ((Number) r[1]).longValue())).toList());
        long xp = leagues.weeklyXp(u.getId());
        body.put("weeklyXp", xp);
        body.put("league", com.interview.backend.service.LeagueService.league(xp));
        body.put("totalQuestions", total);
        body.put("visitedCount", visitedIds.size());
        body.put("solvedCount", solvedIds.size());
        body.put("flaggedCount", flaggedIds.size());
        body.put("importantCount", importantCount);
        body.put("byTech", byTech);
        body.put("byDifficulty", byDifficulty);
        return body;
    }

    /** Upload a profile picture (multipart field "file"). It replaces any earlier upload and wins over the Google picture. */
    @PostMapping(value = "/avatar", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        User u = currentUser();
        try {
            String url = images.uploadAvatar(file);
            String old = u.getAvatarUrl();
            u.setAvatarUrl(url);
            userRepository.save(u);
            images.deleteByUrl(old);
            return ResponseEntity.ok(Map.of("picture", u.effectivePicture(), "hasUploadedPicture", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed. Try a different picture."));
        }
    }

    /** Remove the uploaded picture; the Google picture (if the member has one) shows again, else the initial. */
    @DeleteMapping("/avatar")
    public ResponseEntity<?> removeAvatar() {
        User u = currentUser();
        String old = u.getAvatarUrl();
        u.setAvatarUrl(null);
        userRepository.save(u);
        images.deleteByUrl(old);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("picture", u.effectivePicture());
        out.put("hasUploadedPicture", false);
        return ResponseEntity.ok(out);
    }

    public record PublicDetailsRequest(String headline, String college, String github, String linkedin, String website, String bio, List<String> skills) {}

    /**
     * The optional details shown on the member's public profile. Replaces all of them at once (a blank field clears it), so the form can
     * simply send what it shows. Handles for GitHub and LinkedIn are reduced to the bare name; see PublicDetails for the rules.
     */
    @PutMapping("/public-details")
    public ResponseEntity<?> savePublicDetails(@RequestBody PublicDetailsRequest req) {
        User u = currentUser();
        try {
            var c = com.interview.backend.service.PublicDetails.clean(req.headline(), req.college(), req.github(), req.linkedin(), req.website(), req.bio(), req.skills());
            u.setHeadline(c.headline()); u.setCollege(c.college()); u.setGithubUser(c.github()); u.setLinkedinHandle(c.linkedin());
            u.setWebsiteUrl(c.website()); u.setBio(c.bio()); u.setSkills(c.skills().isEmpty() ? null : String.join(",", c.skills()));
            userRepository.save(u);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("details", com.interview.backend.service.PublicDetails.view(u.getHeadline(), u.getCollege(), u.getGithubUser(), u.getLinkedinHandle(), u.getWebsiteUrl(), u.getBio(), u.getSkills()));
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public record LocationRequest(String country, String city) {}

    /** User-entered location; overrides the IP guess. Both fields are required and validated. */
    @PutMapping("/location")
    public ResponseEntity<Map<String, String>> updateLocation(@RequestBody LocationRequest req) {
        User u = currentUser();
        LocationRules.Location loc;
        try {
            loc = LocationRules.validate(req.country(), req.city());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        GeoService.applyUserLocation(u, loc.country(), loc.city());
        userRepository.save(u);
        return ResponseEntity.ok(Map.of(
                "country", u.getCountry() == null ? "" : u.getCountry(),
                "city", u.getCity() == null ? "" : u.getCity(),
                "locationSource", u.getLocationSource() == null ? "" : u.getLocationSource()));
    }

    public record NoteRequest(String title, String body) {}

    private static final int NOTE_BODY_MAX = 5000;
    private static final int NOTE_TITLE_MAX = 120;

    private static Map<String, Object> noteView(UserNote n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("title", n.getTitle());
        m.put("body", n.getBody());
        m.put("createdAt", n.getCreatedAt());
        m.put("updatedAt", n.getUpdatedAt());
        return m;
    }

    /** Validates and normalises a note's title and body. Returns an error message, or null when valid. */
    private static String noteError(NoteRequest req) {
        String body = req.body() == null ? "" : req.body().strip();
        if (body.isEmpty()) return "Write something in the note first";
        if (body.length() > NOTE_BODY_MAX) return "Note is too long (max " + NOTE_BODY_MAX + " characters)";
        String title = req.title() == null ? "" : req.title().strip();
        if (title.length() > NOTE_TITLE_MAX) return "Title is too long (max " + NOTE_TITLE_MAX + " characters)";
        return null;
    }

    @GetMapping("/notes")
    public ResponseEntity<List<Map<String, Object>>> notes() {
        return ResponseEntity.ok(userNotes.findByUserIdOrderByUpdatedAtDesc(currentUser().getId())
                .stream().map(ProfileController::noteView).toList());
    }

    @PostMapping("/notes")
    public ResponseEntity<?> createNote(@RequestBody NoteRequest req) {
        String error = noteError(req);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("error", error));
        UserNote n = new UserNote();
        n.setUserId(currentUser().getId());
        n.setTitle(title(req));
        n.setBody(req.body().strip());
        return ResponseEntity.status(201).body(noteView(userNotes.save(n)));
    }

    @PutMapping("/notes/{id}")
    public ResponseEntity<?> updateNote(@PathVariable Long id, @RequestBody NoteRequest req) {
        String error = noteError(req);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("error", error));
        UserNote n = userNotes.findByIdAndUserId(id, currentUser().getId()).orElse(null);
        if (n == null) return ResponseEntity.notFound().build();
        n.setTitle(title(req));
        n.setBody(req.body().strip());
        n.setUpdatedAt(java.time.Instant.now());
        return ResponseEntity.ok(noteView(userNotes.save(n)));
    }

    @DeleteMapping("/notes/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        UserNote n = userNotes.findByIdAndUserId(id, currentUser().getId()).orElse(null);
        if (n == null) return ResponseEntity.notFound().build();
        userNotes.delete(n);
        return ResponseEntity.noContent().build();
    }

    private static String title(NoteRequest req) {
        String t = req.title() == null ? "" : req.title().strip();
        return t.isEmpty() ? "Untitled note" : t;
    }

    public record UsernameRequest(String username) {}

    /** Change your public handle. Taken names are refused; the old one stops resolving. */
    @PutMapping("/username")
    public ResponseEntity<Map<String, String>> updateUsername(@RequestBody UsernameRequest req) {
        User u = currentUser();
        String name;
        try {
            name = com.interview.backend.service.UsernameService.validate(req.username());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        if (name.equals(u.getUsername())) return ResponseEntity.ok(Map.of("username", name));
        if (!usernames.isAvailable(name)) {
            return ResponseEntity.status(409).body(Map.of("error", "That username is taken"));
        }
        u.setUsername(name);
        userRepository.save(u);
        usernames.taken(name);
        return ResponseEntity.ok(Map.of("username", name));
    }

    @GetMapping("/questions/solved")
    public ResponseEntity<List<com.interview.backend.dto.QuestionSummary>> solvedQuestions() {
        return ResponseEntity.ok(questionsFor(UserProgress::isRead));
    }

    @GetMapping("/questions/visited")
    public ResponseEntity<List<com.interview.backend.dto.QuestionSummary>> visitedQuestions() {
        return ResponseEntity.ok(questionsFor(UserProgress::isVisited));
    }

    @GetMapping("/questions/flagged")
    public ResponseEntity<List<com.interview.backend.dto.QuestionSummary>> flaggedQuestions() {
        return ResponseEntity.ok(questionsFor(UserProgress::isFlagged));
    }

    @GetMapping("/questions/important")
    public ResponseEntity<List<com.interview.backend.dto.QuestionSummary>> importantQuestions() {
        return ResponseEntity.ok(questionsFor(UserProgress::isImportant));
    }

    // Fetches full Question objects for progress rows belonging to the current user.
    /** Progress rows whose question still exists. A deleted question's progress is ignored, not shown. */
    private List<UserProgress> liveRows(Long userId) {
        List<UserProgress> rows = progressRepository.findByUserId(userId);
        if (rows.isEmpty()) return rows;
        Set<String> live = new java.util.HashSet<>(questionRepository.existingIds(rows.stream().map(UserProgress::getQuestionId).toList()));
        return rows.stream().filter(r -> live.contains(r.getQuestionId())).toList();
    }

    /** Question summaries (no answers) for the member's progress rows matching the filter. */
    private List<com.interview.backend.dto.QuestionSummary> questionsFor(Predicate<UserProgress> include) {
        List<String> ids = liveRows(currentUser().getId()).stream()
                .filter(include)
                .map(UserProgress::getQuestionId)
                .toList();
        return ids.isEmpty() ? List.of() : questionRepository.summariesByIds(ids);
    }
}
