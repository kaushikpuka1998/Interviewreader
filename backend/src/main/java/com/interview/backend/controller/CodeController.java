package com.interview.backend.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.code.CodeJobs;
import com.interview.backend.code.CodeLanguages;
import com.interview.backend.code.CodeRunner;
import com.interview.backend.entity.CodeSubmission;
import com.interview.backend.entity.CodingProblem;
import com.interview.backend.repository.CodeSubmissionRepository;
import com.interview.backend.repository.FeatureFlagRepository;
import com.interview.backend.repository.CodingProblemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/** Runs code for a signed-in user, either once or against a coding problem's tests, through a queue. */
@RestController
@RequestMapping("/code")
public class CodeController {

    private static final Logger log = LoggerFactory.getLogger(CodeController.class);

    public record RunRequest(String language, String code, String stdin, Long problemId) {}
    public record TestRequest(Long problemId, String language, String code, Boolean submit) {}

    private static final int MAX_CODE = 20_000;
    private static final int MAX_STDIN = 4_000;
    private static final int MAX_TESTS = 20;
    private static final int RUNS_PER_MINUTE = 100_000;   // per signed-in user

    private final CodeRunner runner;
    private final CodingProblemRepository problems;
    private final CodeJobs jobs;
    private final FeatureFlagRepository flags;
    private final CodeSubmissionRepository submissions;
    private final ObjectMapper json = new ObjectMapper();
    // user -> [windowStartMillis, count]
    private final Map<String, long[]> windows = new ConcurrentHashMap<>();

    public CodeController(CodeRunner runner, CodingProblemRepository problems, CodeJobs jobs, FeatureFlagRepository flags, CodeSubmissionRepository submissions) {
        this.submissions = submissions;
        this.runner = runner;
        this.problems = problems;
        this.jobs = jobs;
        this.flags = flags;
    }

    @PostMapping("/run")
    public ResponseEntity<?> run(@RequestBody RunRequest req, Authentication auth) {
        if (!codePracticeOn()) return paused();
        if (!runner.configured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "The code runner isn't set up yet."));
        }
        CodeLanguages.Language lang = CodeLanguages.find(req.language() == null ? "" : req.language()).orElse(null);
        if (lang == null) return ResponseEntity.badRequest().body(Map.of("error", "That language isn't supported."));
        if (req.code() == null || req.code().isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Write some code first."));
        if (req.code().length() > MAX_CODE) return ResponseEntity.badRequest().body(Map.of("error", "The code is too long (max 20,000 characters)."));
        if (req.stdin() != null && req.stdin().length() > MAX_STDIN) return ResponseEntity.badRequest().body(Map.of("error", "The input is too long (max 4,000 characters)."));
        if (!allow(auth.getName(), 1)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Too many runs. Wait a minute and try again."));
        }
        String stdin = req.stdin() == null ? "" : req.stdin();
        // In a coding problem, custom input goes through the same driver as the tests, so the function is called with it.
        String source = req.code();
        if (req.problemId() != null) {
            CodingProblem p = problems.findById(req.problemId()).orElse(null);
            if (p == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Problem not found."));
            String driver = CodingProblemController.driverFor(p, lang.key());
            if (driver == null) return ResponseEntity.badRequest().body(Map.of("error", "This problem is not set up for " + lang.label() + " yet."));
            source = sourceWithDriver(lang, req.code(), CodingProblemController.preludeFor(p, lang.key()), driver);
        }
        String toRun = source;
        return enqueue(auth.getName(), () -> runOnce(lang, toRun, stdin));
    }

    /**
     * Runs the code once per test case of the coding problem and compares the output (line endings and
     * trailing spaces ignored). Expected and actual outputs are not returned, only pass or fail.
     */
    @PostMapping("/test")
    public ResponseEntity<?> test(@RequestBody TestRequest req, Authentication auth) {
        if (!codePracticeOn()) return paused();
        if (!runner.configured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "The code runner isn't set up yet."));
        }
        CodeLanguages.Language lang = CodeLanguages.find(req.language() == null ? "" : req.language()).orElse(null);
        if (lang == null) return ResponseEntity.badRequest().body(Map.of("error", "That language isn't supported."));
        if (req.code() == null || req.code().isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Write some code first."));
        if (req.code().length() > MAX_CODE) return ResponseEntity.badRequest().body(Map.of("error", "The code is too long (max 20,000 characters)."));

        CodingProblem p = req.problemId() == null ? null : problems.findById(req.problemId()).orElse(null);
        if (p == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Problem not found."));

        List<Map<String, Object>> tests;
        try {
            tests = json.readValue(p.getTestCases(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (IOException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "This problem's test cases are not valid."));
        }
        if (tests.size() > MAX_TESTS) return ResponseEntity.badRequest().body(Map.of("error", "This problem has too many test cases."));
        // A problem with a driver runs the member's function through it, which is C++ only.
        String source = req.code();
        boolean hasTemplates = p.getTemplates() != null || p.getDriver() != null;
        if (hasTemplates) {
            String driver = CodingProblemController.driverFor(p, lang.key());
            if (driver == null) return ResponseEntity.badRequest().body(Map.of("error", "This problem is not set up for " + lang.label() + " yet."));
            source = sourceWithDriver(lang, req.code(), CodingProblemController.preludeFor(p, lang.key()), driver);
        }
        // Run uses only the visible tests. Submit uses every test, hidden ones included, and is saved.
        boolean submit = Boolean.TRUE.equals(req.submit());
        List<Map<String, Object>> runList = submit ? tests : tests.stream().filter(t -> !Boolean.TRUE.equals(t.get("hidden"))).toList();
        if (runList.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "This problem has no visible tests. Submit to run all tests."));
        // One press counts as one request, however many tests the problem has.
        if (!allow(auth.getName(), 1)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Too many runs. Wait a minute and try again."));
        }
        String toRun = source;
        String user = auth.getName();
        Long problemId = p.getId();
        return enqueue(user, () -> {
            CodeJobs.Outcome out = runTests(lang, toRun, runList);
            if (!submit || out.httpStatus() != 200) return out;
            int passed = ((Number) out.body().get("passed")).intValue();
            int total = ((Number) out.body().get("total")).intValue();
            CodeSubmission saved = new CodeSubmission();
            saved.setUserEmail(user);
            saved.setProblemId(problemId);
            saved.setLanguage(lang.key());
            saved.setCode(req.code());
            saved.setPassed(passed);
            saved.setTotal(total);
            saved.setStatus(passed == total ? "Accepted" : String.valueOf(out.body().get("verdict")));
            try {
                saved.setResults(json.writeValueAsString(out.body().get("results")));
            } catch (JsonProcessingException e) {
                saved.setResults("[]");
            }
            submissions.save(saved);
            Map<String, Object> body = new LinkedHashMap<>(out.body());
            body.put("submissionId", saved.getId());
            body.put("status", saved.getStatus());
            return new CodeJobs.Outcome(200, body);
        });
    }

    /** The member's last saved submissions for a problem, newest first. */
    /** The member's submission times over the last year. The browser groups them by local date for the heatmap. */
    @GetMapping("/activity")
    public Map<String, Object> activity(Authentication auth) {
        java.time.Instant since = java.time.Instant.EPOCH;   // all of it: the calendar lets the member pick any past year
        List<String> times = submissions.findByUserEmailAndCreatedAtAfter(auth.getName(), since).stream()
                .map(s -> s.getCreatedAt().toString()).toList();
        return Map.of("times", times);
    }

    /** Ids of every problem this member has submitted to, solved or not. Run alone does not count. */
    @GetMapping("/attempted")
    public List<Long> attempted(Authentication auth) {
        return submissions.findByUserEmail(auth.getName()).stream()
                .map(CodeSubmission::getProblemId).distinct().toList();
    }

    /** Ids of the problems this member has solved (an Accepted submission). */
    @GetMapping("/solved")
    public List<Long> solved(Authentication auth) {
        return submissions.findByUserEmailAndStatus(auth.getName(), "Accepted").stream()
                .map(CodeSubmission::getProblemId).distinct().toList();
    }

    @GetMapping("/submissions")
    public List<Map<String, Object>> listSubmissions(@RequestParam Long problemId, Authentication auth) {
        return submissions.findTop20ByUserEmailAndProblemIdOrderByCreatedAtDesc(auth.getName(), problemId).stream().map(s -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", s.getId());
            row.put("language", s.getLanguage());
            row.put("status", s.getStatus());
            row.put("passed", s.getPassed());
            row.put("total", s.getTotal());
            row.put("createdAt", s.getCreatedAt().toString());
            return row;
        }).toList();
    }

    /** One saved submission: its code and the per-test results. */
    @GetMapping("/submissions/{id}")
    public ResponseEntity<?> getSubmission(@PathVariable Long id, Authentication auth) {
        return submissions.findByIdAndUserEmail(id, auth.getName()).<ResponseEntity<?>>map(s -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", s.getId());
            out.put("language", s.getLanguage());
            out.put("code", s.getCode());
            out.put("status", s.getStatus());
            out.put("passed", s.getPassed());
            out.put("total", s.getTotal());
            out.put("results", s.getResults() == null ? List.of() : parseList(s.getResults()));
            return ResponseEntity.ok(out);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private List<Object> parseList(String text) {
        try {
            return json.readValue(text, new TypeReference<List<Object>>() {});
        } catch (IOException e) {
            return List.of();
        }
    }

    /** Status of a queued job: QUEUED (with its place in line), RUNNING, or DONE (with the result). */
    @GetMapping("/jobs/{id}")
    public ResponseEntity<?> job(@PathVariable String id, Authentication auth) {
        CodeJobs.Job job = jobs.find(id, auth.getName());
        if (job == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "This run was not found. Try again."));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("state", job.state().name());
        if (job.state() == CodeJobs.State.QUEUED) out.put("position", jobs.position(job));
        if (job.state() == CodeJobs.State.DONE && job.outcome() != null) {
            out.put("httpStatus", job.outcome().httpStatus());
            out.put("body", job.outcome().body());
        }
        return ResponseEntity.ok(out);
    }

    // Turned off from the admin Feature flags tab, to stop new runs when something goes wrong.
    private boolean codePracticeOn() {
        return flags.findById("code_practice").map(f -> f.isEnabled()).orElse(true);
    }

    private static ResponseEntity<?> paused() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "Code practice is paused right now. Please try again later."));
    }

    private ResponseEntity<?> enqueue(String user, java.util.function.Supplier<CodeJobs.Outcome> task) {
        try {
            CodeJobs.Job job = jobs.submit(user, task);
            return ResponseEntity.accepted().body(Map.of("jobId", job.id(), "state", "QUEUED"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "The code runner is busy. Try again in a moment."));
        }
    }

    /** Adds the problem's prelude before the member's code and its driver after. C++ solutions get the standard headers, so members don't have to write them. */
    private static String sourceWithDriver(CodeLanguages.Language lang, String code, String prelude, String driver) {
        String header = "cpp".equals(lang.key()) ? "#include <bits/stdc++.h>\nusing namespace std;\n" : "";
        String before = prelude == null ? "" : prelude + "\n";
        return header + before + code + "\n" + driver;
    }

    private CodeJobs.Outcome runOnce(CodeLanguages.Language lang, String code, String stdin) {
        try {
            CodeRunner.Result r = runner.run(lang, code, stdin);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("status", r.status());
            out.put("stdout", r.stdout());
            out.put("stderr", r.stderr());
            out.put("compileOutput", r.compileOutput());
            out.put("time", r.time());
            out.put("memoryKb", r.memoryKb());
            return new CodeJobs.Outcome(200, out);
        } catch (IOException e) {
            log.warn("Code runner call failed: {}", e.getMessage());
            return new CodeJobs.Outcome(502, Map.of("error", "The code runner is unavailable right now."));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new CodeJobs.Outcome(503, Map.of("error", "The run was interrupted. Try again."));
        }
    }

    private CodeJobs.Outcome runTests(CodeLanguages.Language lang, String code, List<Map<String, Object>> tests) {
        List<Map<String, Object>> results = new ArrayList<>();
        int passed = 0;
        try {
            for (int i = 0; i < tests.size(); i++) {
                Map<String, Object> t = tests.get(i);
                String input = String.valueOf(t.getOrDefault("input", ""));
                String expected = String.valueOf(t.getOrDefault("expected", ""));
                CodeRunner.Result r = runner.run(lang, code, input);
                boolean ok = "Accepted".equals(r.status()) && normalize(r.stdout()).equals(normalize(expected));
                if (ok) passed++;
                boolean hidden = Boolean.TRUE.equals(t.get("hidden"));
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("number", i + 1);
                row.put("passed", ok);
                row.put("status", ok ? "Accepted" : ("Accepted".equals(r.status()) ? "Wrong Answer" : r.status()));
                row.put("hidden", hidden);
                // Visible tests show their details, like LeetCode. Hidden tests show only pass or fail.
                if (!hidden) {
                    row.put("input", input);
                    // Tree inputs are drawn as a diagram in the results.
                    row.put("treeInput", Boolean.TRUE.equals(t.get("treeInput")));
                    row.put("expected", expected);
                    row.put("actual", r.stdout() == null ? "" : r.stdout());
                    row.put("stderr", r.stderr() == null ? "" : r.stderr());
                    row.put("compileOutput", r.compileOutput() == null ? "" : r.compileOutput());
                }
                results.add(row);
            }
        } catch (IOException e) {
            log.warn("Code runner call failed: {}", e.getMessage());
            return new CodeJobs.Outcome(502, Map.of("error", "The code runner is unavailable right now."));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new CodeJobs.Outcome(503, Map.of("error", "The run was interrupted. Try again."));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("passed", passed);
        out.put("total", tests.size());
        out.put("results", results);
        out.put("verdict", verdictOf(results));
        return new CodeJobs.Outcome(200, out);
    }

    // The verdict comes from the first failing test, so a slow solution reads as Time Limit Exceeded, not Wrong answer.
    static String verdictOf(List<Map<String, Object>> results) {
        for (Map<String, Object> row : results) {
            if (Boolean.TRUE.equals(row.get("passed"))) continue;
            String status = String.valueOf(row.getOrDefault("status", ""));
            if (status.startsWith("Time Limit")) return "Time Limit Exceeded";
            if (status.startsWith("Compilation")) return "Compilation Error";
            if (status.startsWith("Runtime")) return "Runtime Error";
            return "Wrong answer";
        }
        return "Accepted";
    }

    // Line endings and trailing spaces don't count as differences.
    static String normalize(String s) {
        if (s == null) return "";
        return s.lines().map(String::stripTrailing).collect(Collectors.joining("\n")).strip();
    }

    private boolean allow(String user, int runs) {
        long now = System.currentTimeMillis();
        long[] w = windows.compute(user, (k, v) ->
                (v == null || now - v[0] >= 60_000) ? new long[]{now, runs} : new long[]{v[0], v[1] + runs});
        if (windows.size() > 10_000) windows.clear();
        return w[1] <= RUNS_PER_MINUTE;
    }
}
