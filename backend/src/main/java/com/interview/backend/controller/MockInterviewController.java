package com.interview.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.entity.CodingProblem;
import com.interview.backend.entity.MockInterview;
import com.interview.backend.entity.Question;
import com.interview.backend.entity.Resume;
import com.interview.backend.entity.User;
import com.interview.backend.repository.CodingProblemRepository;
import com.interview.backend.repository.MockInterviewRepository;
import com.interview.backend.repository.QuestionRepository;
import com.interview.backend.repository.ResumeRepository;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

/**
 * Mock interviews. A candidate asks for one (type + optional resume); an interviewer takes a random waiting
 * request of a type they choose. Matching creates a call link, a shared whiteboard and three random questions
 * that only the interviewer sees, and emails both people.
 */
@Slf4j
@RestController
@RequestMapping("/interviews")
@RequiredArgsConstructor
public class MockInterviewController {

    public record RequestInput(String type, Long resumeId, String slot, Boolean wantsToInterview) {}
    public record AcceptInput(String type) {}
    public record CallLinkInput(String url) {}
    public record PickInput(List<String> items) {}

    private static final Set<String> TYPES = Set.of(MockInterview.CODING, MockInterview.SYSTEM_DESIGN, MockInterview.RESUME);
    private static final SecureRandom RNG = new SecureRandom();
    private static final ObjectMapper JSON = new ObjectMapper();

    private final MockInterviewRepository interviews;
    private final UserRepository users;
    private final ResumeRepository resumes;
    private final QuestionRepository questions;
    private final CodingProblemRepository codingProblems;
    private final EmailService email;
    private final com.interview.backend.repository.FeatureFlagRepository flags;

    /** Candidate: ask for an interview. */
    @PostMapping("/request")
    public ResponseEntity<?> request(@RequestBody RequestInput in) {
        User me = me();
        if (in.type() == null || !TYPES.contains(in.type())) return bad("Choose an interview type.");
        if (in.resumeId() != null && resumes.findByIdAndUserId(in.resumeId(), me.getId()).isEmpty()) return bad("That resume is not yours.");
        if (MockInterview.RESUME.equals(in.type()) && in.resumeId() == null) return bad("Choose the resume to be discussed.");
        Instant slot;
        try { slot = Instant.parse(in.slot()); } catch (Exception e) { return bad("Pick the date and time you would like the interview."); }
        if (slot.isBefore(Instant.now().plusSeconds(10 * 60))) return bad("Pick a time at least 10 minutes from now.");
        if (slot.isAfter(Instant.now().plusSeconds(60L * 24 * 3600 * 30))) return bad("Pick a time within the next 30 days.");
        // Several interviews are fine as long as they are at different times (an hour apart) and not too many are open.
        int open = 0;
        for (MockInterview other : interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(me.getId(), me.getId())) {
            if (!(MockInterview.WAITING.equals(other.getStatus()) || MockInterview.MATCHED.equals(other.getStatus()))) continue;
            if (me.getId().equals(other.getCandidateId())) open++;
            if (other.getSlotAt() != null && Math.abs(java.time.Duration.between(other.getSlotAt(), slot).toMinutes()) < 60)
                return bad("You already have an interview within an hour of that time. Pick another time.");
        }
        if (open >= MAX_OPEN_AS_CANDIDATE) return bad("You can have at most " + MAX_OPEN_AS_CANDIDATE + " interviews open at once. Finish or cancel one first.");
        MockInterview m = new MockInterview();
        m.setSlotAt(slot);
        m.setWantsToInterview(Boolean.TRUE.equals(in.wantsToInterview()));
        m.setCandidateId(me.getId());
        m.setType(in.type());
        m.setResumeId(in.resumeId());
        return ResponseEntity.ok(view(interviews.save(m), me));
    }

    /** Interviewer: take a random waiting candidate of this type. */
    @PostMapping("/accept")
    public ResponseEntity<?> accept(@RequestBody AcceptInput in) {
        User me = me();
        if (!canInterview()) return ResponseEntity.status(403).body(Map.of("error", "Interviews are currently taken by our team only."));
        if (in.type() == null || !TYPES.contains(in.type())) return bad("Choose an interview type.");
        List<MockInterview> waiting = new ArrayList<>(interviews.findByStatusAndTypeAndCandidateIdNot(MockInterview.WAITING, in.type(), me.getId()));
        waiting.removeIf(w -> w.getSlotAt() != null && w.getSlotAt().isBefore(Instant.now()));   // a slot in the past can no longer be met
        if (waiting.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "No candidate is waiting for this interview type right now. Try again in a little while."));
        return ResponseEntity.ok(match(waiting.get(RNG.nextInt(waiting.size())), me));
    }

    /** Whether the signed-in user may interview: always for admins, for everyone while the interviewer_open flag is on. */
    private boolean canInterview() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = a != null && a.getAuthorities().stream().anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
        return admin || flags.findById("interviewer_open").map(com.interview.backend.entity.FeatureFlag::isEnabled).orElse(false);
    }

    /** Upcoming interviews still waiting for an interviewer (soonest first), without any candidate details. For people who may interview. */
    @GetMapping("/upcoming")
    public ResponseEntity<?> upcoming() {
        if (!canInterview()) return ResponseEntity.status(403).body(Map.of("error", "Not available."));
        User me = me();
        List<Map<String, Object>> out = new ArrayList<>();
        interviews.findAll().stream()
                .filter(m -> MockInterview.WAITING.equals(m.getStatus()) && !m.getCandidateId().equals(me.getId()) && (m.getSlotAt() == null || m.getSlotAt().isAfter(Instant.now())))
                .sorted(Comparator.comparing(m -> m.getSlotAt() == null ? Instant.MAX : m.getSlotAt()))
                .forEach(m -> out.add(Map.of("id", m.getId(), "type", m.getType(), "slotAt", m.getSlotAt() == null ? "" : m.getSlotAt().toString(), "hasResume", m.getResumeId() != null,
                        "candidate", users.findById(m.getCandidateId()).map(MockInterviewController::displayName).orElse("A member"),
                        "candidateEmail", users.findById(m.getCandidateId()).map(User::getEmail).orElse(""))));
        return ResponseEntity.ok(out);
    }

    /** Take one specific waiting request (admins always; other members while the interviewer_open flag is on). */
    @PostMapping("/{id}/take")
    public ResponseEntity<?> take(@PathVariable Long id) {
        User me = me();
        if (!canInterview()) return ResponseEntity.status(403).body(Map.of("error", "Interviews are currently taken by our team only."));
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !MockInterview.WAITING.equals(m.getStatus())) return bad("That request is no longer waiting.");
        if (m.getCandidateId().equals(me.getId())) return bad("You cannot interview yourself.");
        if (m.getSlotAt() != null && m.getSlotAt().isBefore(Instant.now())) return bad("That time has already passed.");
        if (clashes(me, m)) return bad("You already have an interview within an hour of that time. Pick another request.");
        return ResponseEntity.ok(match(m, me));
    }

    /** Admin: every open or matched interview, with who asked, when, and who is interested in interviewing. */
    @GetMapping("/admin/all")
    public List<Map<String, Object>> adminAll() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (MockInterview m : interviews.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))) {
            Map<String, Object> row = new LinkedHashMap<>();
            User c = users.findById(m.getCandidateId()).orElse(null);
            row.put("id", m.getId());
            row.put("type", m.getType());
            row.put("status", m.getStatus());
            row.put("noShowBy", m.getNoShowBy());
            row.put("slotAt", m.getSlotAt());
            row.put("createdAt", m.getCreatedAt());
            row.put("candidateName", c == null ? null : c.getName());
            row.put("candidateEmail", c == null ? null : c.getEmail());
            row.put("hasResume", m.getResumeId() != null);
            row.put("wantsToInterview", Boolean.TRUE.equals(m.getWantsToInterview()));
            row.put("interviewer", m.getInterviewerId() == null ? null : users.findById(m.getInterviewerId()).map(User::getEmail).orElse(null));
            out.add(row);
        }
        return out;
    }

    /** Admin: take a waiting interview yourself. */
    @PostMapping("/admin/{id}/take")
    public ResponseEntity<?> adminTake(@PathVariable Long id) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !MockInterview.WAITING.equals(m.getStatus())) return bad("That interview is no longer waiting.");
        if (m.getCandidateId().equals(me.getId())) return bad("You cannot interview yourself.");
        if (clashes(me, m)) return bad("You already have an interview within an hour of that time.");
        return ResponseEntity.ok(match(m, me));
    }

    /** An interviewer may hold many interviews, but not two that start within an hour of each other. */
    private boolean clashes(User interviewer, MockInterview wanted) {
        if (wanted.getSlotAt() == null) return false;
        for (MockInterview other : interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(-1L, interviewer.getId())) {
            if (!MockInterview.MATCHED.equals(other.getStatus()) || other.getSlotAt() == null) continue;
            if (Math.abs(java.time.Duration.between(other.getSlotAt(), wanted.getSlotAt()).toMinutes()) < 60) return true;
        }
        return false;
    }

    private Map<String, Object> match(MockInterview m, User me) {
        m.setInterviewerId(me.getId());
        m.setStatus(MockInterview.MATCHED);
        m.setMatchedAt(Instant.now());
        m.setWhiteboardUrl("https://excalidraw.com/#room=" + hex(10) + "," + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(16)));
        m.setQuestionsJson(pickQuestions(m));
        interviews.save(m);
        notifyBoth(m, me);
        return view(m, me);
    }

    /** Everything I am part of, newest first. */
    @GetMapping("/mine")
    public List<Map<String, Object>> mine() {
        User me = me();
        List<Map<String, Object>> out = new ArrayList<>();
        for (MockInterview m : interviews.findByCandidateIdOrInterviewerIdOrderByCreatedAtDesc(me.getId(), me.getId())) out.add(view(m, me));
        return out;
    }

    /** The candidate's resume, for the matched interviewer only. */
    @GetMapping("/{id}/resume")
    public ResponseEntity<?> resume(@PathVariable Long id) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !me.getId().equals(m.getInterviewerId()) || !MockInterview.MATCHED.equals(m.getStatus()) || m.getResumeId() == null)
            return ResponseEntity.status(404).body(Map.of("error", "No resume to show."));
        if (!prepOpen(m)) return ResponseEntity.status(403).body(Map.of("error", "The resume opens " + PREP_MINUTES + " minutes before the start time."));
        Resume r = resumes.findById(m.getResumeId()).orElse(null);
        if (r == null) return ResponseEntity.status(404).body(Map.of("error", "The resume was deleted."));
        try {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("title", r.getTitle());
            out.put("templateId", r.getTemplateId());
            out.put("data", JSON.readTree(r.getData()));
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not read the resume."));
        }
    }

    private static final int MAX_QUESTIONS = 8;
    private static final int MAX_OPEN_AS_CANDIDATE = 5;

    /** The questions and the resume open this many minutes before the start time. */
    private static final long PREP_MINUTES = 10;

    private static boolean prepOpen(MockInterview m) {
        return m.getSlotAt() == null || !Instant.now().isBefore(m.getSlotAt().minusSeconds(PREP_MINUTES * 60));
    }

    /** Interviewer: search questions to ask. Coding interviews search coding problems; system design searches system design questions; resume discussions search all questions. */
    @GetMapping("/{id}/question-options")
    public ResponseEntity<?> questionOptions(@PathVariable Long id, @RequestParam(defaultValue = "") String q) {
        MockInterview m = mineAsInterviewer(id);
        if (m == null) return ResponseEntity.notFound().build();
        String text = q.trim().toLowerCase();
        List<Map<String, String>> out = new ArrayList<>();
        if (MockInterview.CODING.equals(m.getType())) {
            // A number finds the problem with that id and the one shown with that number in the problem list.
            if (text.matches("^#?\\d{1,9}$")) {
                long n = Long.parseLong(text.replace("#", ""));
                Set<Long> seen = new LinkedHashSet<>();
                codingProblems.findById(n).ifPresent(p -> { seen.add(p.getId()); out.add(Map.of("ref", "c:" + p.getId(), "title", "#" + p.getId() + " " + p.getTitle() + " (" + p.getDifficulty() + ")")); });
                var summaries = codingProblems.findSummariesByOrderByIdAsc();
                if (n >= 1 && n <= summaries.size()) {
                    var s = summaries.get((int) n - 1);
                    if (seen.add(s.getId())) out.add(Map.of("ref", "c:" + s.getId(), "title", "#" + n + " " + s.getTitle() + " (" + s.getDifficulty() + ")"));
                }
            } else {
                for (CodingProblem p : codingProblems.findTop15ByTitleContainingIgnoreCaseOrderByIdAsc(text))
                    out.add(Map.of("ref", "c:" + p.getId(), "title", p.getTitle() + " (" + p.getDifficulty() + ")"));
            }
        } else {
            String tech = MockInterview.SYSTEM_DESIGN.equals(m.getType()) ? "hld" : null;
            for (Question qu : questions.searchForInterview(tech, "%" + text + "%", org.springframework.data.domain.PageRequest.of(0, 15)))
                out.add(Map.of("ref", "q:" + qu.getId(), "title", qu.getQuestion() == null ? qu.getTitle() : qu.getQuestion()));
        }
        return ResponseEntity.ok(out);
    }

    /** Interviewer: set the questions to ask, by reference ("c:<id>" coding problem, "q:<id>" question). */
    @PutMapping("/{id}/questions")
    public ResponseEntity<?> setQuestions(@PathVariable Long id, @RequestBody PickInput in) {
        MockInterview m = mineAsInterviewer(id);
        if (m == null) return ResponseEntity.notFound().build();
        List<String> refs = in.items() == null ? List.of() : in.items();
        if (refs.size() > MAX_QUESTIONS) return bad("Pick at most " + MAX_QUESTIONS + " questions.");
        List<Map<String, String>> picked = new ArrayList<>();
        for (String ref : refs) {
            if (ref == null || ref.length() < 3) continue;
            if (ref.startsWith("c:")) {
                try {
                    codingProblems.findById(Long.parseLong(ref.substring(2))).ifPresent(p ->
                            picked.add(Map.of("ref", ref, "title", p.getTitle() + " (" + p.getDifficulty() + ")", "body", p.getStatement())));
                } catch (NumberFormatException ignored) { /* skip a bad reference */ }
            } else if (ref.startsWith("q:")) {
                questions.findById(ref.substring(2)).ifPresent(qu ->
                        picked.add(Map.of("ref", ref, "title", qu.getQuestion() == null ? qu.getTitle() : qu.getQuestion(), "body", qu.getAnswer() == null ? "" : qu.getAnswer())));
            }
        }
        try { m.setQuestionsJson(JSON.writeValueAsString(picked)); } catch (Exception e) { return bad("Could not save the questions."); }
        interviews.save(m);
        return ResponseEntity.ok(view(m, me()));
    }

    /** Interviewer: replace the questions with three new random ones. */
    @PostMapping("/{id}/questions/random")
    public ResponseEntity<?> randomQuestions(@PathVariable Long id) {
        MockInterview m = mineAsInterviewer(id);
        if (m == null) return ResponseEntity.notFound().build();
        m.setQuestionsJson(pickQuestions(m));
        interviews.save(m);
        return ResponseEntity.ok(view(m, me()));
    }

    private MockInterview mineAsInterviewer(Long id) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        return m != null && me.getId().equals(m.getInterviewerId()) && MockInterview.MATCHED.equals(m.getStatus()) && prepOpen(m) ? m : null;
    }

    /** Interviewer: share the Google Meet link. The candidate sees the call button once it is set. */
    @PostMapping("/{id}/call-link")
    public ResponseEntity<?> callLink(@PathVariable Long id, @RequestBody CallLinkInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !me.getId().equals(m.getInterviewerId()) || !MockInterview.MATCHED.equals(m.getStatus())) return ResponseEntity.notFound().build();
        String url = in.url() == null ? "" : in.url().trim();
        if (!url.matches("^https://meet\\.google\\.com/[A-Za-z0-9?=&_/.-]{3,100}$")) return bad("Paste a Google Meet link, like https://meet.google.com/abc-defg-hij");
        boolean first = m.getCallUrl() == null;
        m.setCallUrl(url);
        interviews.save(m);
        if (first) {
            try {
                users.findById(m.getCandidateId()).ifPresent(c -> email.sendAnnouncement(c.getEmail(), "Your interviewer shared the video call link",
                        "Your interviewer added the Google Meet link for your mock interview. Open Interview Reader, go to Interview and press Join video call: https://interviewreader.cloud/interview"));
            } catch (Exception e) { log.warn("Could not email the call link notice", e); }
        }
        return ResponseEntity.ok(view(m, me));
    }

    /** Minutes after the start time before someone can report that the other person did not join. */
    private static final long NO_SHOW_GRACE_MINUTES = 0;

    /** Either person: the other one did not join. Closes the interview and tells the absent person. */
    @PostMapping("/{id}/no-show")
    public ResponseEntity<?> noShow(@PathVariable Long id) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (!MockInterview.MATCHED.equals(m.getStatus())) return bad("Only a matched interview can be reported.");
        if (m.getSlotAt() != null && Instant.now().isBefore(m.getSlotAt().plusSeconds(NO_SHOW_GRACE_MINUTES * 60)))
            return bad("You can report a no-show once the interview start time has arrived.");
        // Only the interviewer can report a no-show (that the candidate did not join).
        if (!me.getId().equals(m.getInterviewerId())) return bad("Only the interviewer can report that the candidate did not join.");
        boolean iAmCandidate = false;
        m.setNoShowBy("CANDIDATE");
        m.setStatus(MockInterview.NO_SHOW);
        interviews.save(m);
        try {
            Long absentId = iAmCandidate ? m.getInterviewerId() : m.getCandidateId();
            users.findById(absentId).ifPresent(u -> email.sendAnnouncement(u.getEmail(), "You missed a mock interview",
                    "Your " + (iAmCandidate ? "interviewer" : "candidate") + " reported that you did not join the mock interview planned for " + when(m) + ". Please join on time next time, so others can rely on you."));
        } catch (Exception e) { log.warn("Could not email the no-show notice", e); }
        return ResponseEntity.ok(view(m, me));
    }

    /** Hours after the start time before an interview can be marked as finished (either person). */
    private static final long FINISH_AFTER_HOURS = 1;

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> complete(@PathVariable Long id) {
        MockInterview m = interviews.findById(id).orElse(null);
        if (m != null && MockInterview.MATCHED.equals(m.getStatus())) {
            Instant start = m.getSlotAt() != null ? m.getSlotAt() : m.getMatchedAt();
            if (start != null && Instant.now().isBefore(start.plusSeconds(FINISH_AFTER_HOURS * 3600)))
                return bad("An interview can be marked as finished " + FINISH_AFTER_HOURS + " hour after its start time.");
        }
        return finish(id, MockInterview.DONE);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long id) { return finish(id, MockInterview.CANCELLED); }

    private ResponseEntity<?> finish(Long id, String status) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (MockInterview.DONE.equals(m.getStatus()) || MockInterview.CANCELLED.equals(m.getStatus())) return ResponseEntity.ok(view(m, me));
        m.setStatus(status);
        return ResponseEntity.ok(view(interviews.save(m), me));
    }

    // ---- helpers ----

    private Map<String, Object> view(MockInterview m, User me) {
        boolean interviewer = me.getId().equals(m.getInterviewerId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("role", interviewer ? "interviewer" : "candidate");
        out.put("type", m.getType());
        out.put("status", m.getStatus());
        out.put("createdAt", m.getCreatedAt());
        out.put("matchedAt", m.getMatchedAt());
        out.put("slotAt", m.getSlotAt());
        out.put("noShowBy", m.getNoShowBy());
        boolean matched = MockInterview.MATCHED.equals(m.getStatus());
        // Only a link the interviewer added (Google Meet) is shown; links from the earlier auto-created rooms are ignored.
        boolean meet = m.getCallUrl() != null && m.getCallUrl().startsWith("https://meet.google.com/");
        out.put("callUrl", matched && meet ? m.getCallUrl() : null);
        out.put("whiteboardUrl", matched ? m.getWhiteboardUrl() : null);
        out.put("hasResume", m.getResumeId() != null);
        // Only the interviewer sees the questions (and the answers that come with them).
        out.put("prepOpen", prepOpen(m));
        out.put("prepOpensAt", m.getSlotAt() == null ? null : m.getSlotAt().minusSeconds(PREP_MINUTES * 60));
        out.put("questions", interviewer && matched && prepOpen(m) && m.getQuestionsJson() != null ? readJson(m.getQuestionsJson()) : List.of());
        Long otherId = interviewer ? m.getCandidateId() : m.getInterviewerId();
        out.put("partner", otherId == null ? null : users.findById(otherId).map(MockInterviewController::displayName).orElse("A member"));
        // The interviewer also sees the candidate's email, to reach them if the call does not start.
        out.put("partnerEmail", interviewer && otherId != null ? users.findById(otherId).map(User::getEmail).orElse(null) : null);
        return out;
    }

    private Object readJson(String s) {
        try { return JSON.readValue(s, Object.class); } catch (Exception e) { return List.of(); }
    }

    private String pickQuestions(MockInterview m) {
        List<Map<String, String>> picked = new ArrayList<>();
        try {
            if (MockInterview.CODING.equals(m.getType())) {
                List<Long> ids = new ArrayList<>();
                codingProblems.findSummariesByOrderByIdAsc().forEach(p -> ids.add(p.getId()));
                Collections.shuffle(ids, RNG);
                for (Long id : ids.subList(0, Math.min(3, ids.size()))) {
                    CodingProblem p = codingProblems.findById(id).orElse(null);
                    if (p != null) picked.add(Map.of("ref", "c:" + p.getId(), "title", p.getTitle() + " (" + p.getDifficulty() + ")", "body", p.getStatement()));
                }
            } else {
                List<Question> pool = MockInterview.SYSTEM_DESIGN.equals(m.getType()) ? questions.findByTech("hld") : questions.findAll();
                List<Question> copy = new ArrayList<>(pool);
                Collections.shuffle(copy, RNG);
                for (Question q : copy.subList(0, Math.min(3, copy.size())))
                    picked.add(Map.of("ref", "q:" + q.getId(), "title", q.getQuestion() == null ? q.getTitle() : q.getQuestion(), "body", q.getAnswer() == null ? "" : q.getAnswer()));
            }
            return JSON.writeValueAsString(picked);
        } catch (Exception e) {
            log.warn("Could not pick interview questions", e);
            return "[]";
        }
    }

    private void notifyBoth(MockInterview m, User interviewer) {
        String type = switch (m.getType()) { case MockInterview.CODING -> "coding"; case MockInterview.SYSTEM_DESIGN -> "system design"; default -> "resume discussion"; };
        try {
            users.findById(m.getCandidateId()).ifPresent(c -> email.sendAnnouncement(c.getEmail(),
                    "Your " + type + " mock interview is ready",
                    "An interviewer has accepted your " + type + " mock interview, planned for " + when(m) + ". Open Interview Reader and go to Interview to join the call: https://interviewreader.cloud/interview"));
            email.sendAnnouncement(interviewer.getEmail(),
                    "You are interviewing a candidate (" + type + ")",
                    "You took a " + type + " mock interview, planned for " + when(m) + ". Open Interview Reader and go to Interview for the call link, the candidate's resume and your questions: https://interviewreader.cloud/interview");
        } catch (Exception e) {
            log.warn("Could not send interview emails", e);
        }
    }

    private static String when(MockInterview m) {
        return m.getSlotAt() == null ? "a time you agree on" : java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm 'UTC'").withZone(java.time.ZoneOffset.UTC).format(m.getSlotAt());
    }

    /** The member's name, or the part of their email before the @ when they have not set one. */
    private static String displayName(User u) {
        if (u.getName() != null && !u.getName().isBlank()) return u.getName().trim();
        String mail = u.getEmail();
        return mail != null && mail.contains("@") ? mail.substring(0, mail.indexOf('@')) : "A member";
    }

    private static ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(Map.of("error", msg)); }

    private static byte[] randomBytes(int n) { byte[] b = new byte[n]; RNG.nextBytes(b); return b; }

    private static String hex(int bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : randomBytes(bytes)) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private User me() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return users.findByEmail(a.getName()).orElseThrow();
    }
}
