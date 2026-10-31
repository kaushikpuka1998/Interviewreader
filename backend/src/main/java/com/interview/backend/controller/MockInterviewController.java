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
    public record WhiteboardLinkInput(String url) {}
    public record PickInput(List<String> items) {}
    public record StepInput(Integer index) {}
    public record EditorInput(String code, String lang, String output) {}
    public record FeedbackInput(Integer rating, String strengths, String improve) {}
    public record DesignNotesInput(String notes) {}
    public record DesignImageUrlInput(String imageUrl) {}

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
    private final com.interview.backend.service.ImageService imageService;

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

    /** Interviewer: search questions to ask. Coding interviews search coding problems; system design searches HLD and LLD questions; resume discussions search all questions. */
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
        } else if (MockInterview.SYSTEM_DESIGN.equals(m.getType())) {
            // System design: search both HLD (starting with "Design") and LLD questions
            String pattern = "%" + text + "%";
            List<Question> hldResults = questions.searchForInterview("hld", pattern, org.springframework.data.domain.PageRequest.of(0, 15));
            // Filter HLD questions to only those starting with "Design"
            List<Question> filteredHld = hldResults.stream()
                    .filter(question -> {
                        String title = question.getQuestion() == null ? question.getTitle() : question.getQuestion();
                        return title != null && title.toLowerCase().startsWith("design");
                    })
                    .limit(8)
                    .toList();
            List<Question> lldResults = questions.searchForInterview("lld", pattern, org.springframework.data.domain.PageRequest.of(0, 7));
            for (Question qu : filteredHld)
                out.add(Map.of("ref", "q:" + qu.getId(), "title", "[HLD] " + (qu.getQuestion() == null ? qu.getTitle() : qu.getQuestion())));
            for (Question qu : lldResults)
                out.add(Map.of("ref", "q:" + qu.getId(), "title", "[LLD] " + (qu.getQuestion() == null ? qu.getTitle() : qu.getQuestion())));
        } else {
            // Resume interviews can search all questions
            for (Question qu : questions.searchForInterview(null, "%" + text + "%", org.springframework.data.domain.PageRequest.of(0, 15)))
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

    /** Interviewer: update the whiteboard link (default is Excalidraw, but can be changed to Miro, Figma, etc). */
    @PostMapping("/{id}/whiteboard-link")
    public ResponseEntity<?> whiteboardLink(@PathVariable Long id, @RequestBody WhiteboardLinkInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !me.getId().equals(m.getInterviewerId()) || !MockInterview.MATCHED.equals(m.getStatus())) return ResponseEntity.notFound().build();
        String url = in.url() == null ? "" : in.url().trim();
        if (!url.matches("^https?://[A-Za-z0-9.-]+\\.[A-Za-z]{2,}[/A-Za-z0-9?=&_#.-]*$")) return bad("Enter a valid URL (https://...)");
        m.setWhiteboardUrl(url);
        interviews.save(m);
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

    // ---- live session: the interviewer drives, the candidate follows ----

    /** Interviewer: start the live session at the first question. */
    @PostMapping("/{id}/live/start")
    public ResponseEntity<?> liveStart(@PathVariable Long id) {
        MockInterview m = mineAsInterviewer(id);
        if (m == null) return bad("The live room opens 10 minutes before the start time.");
        if (m.getCurrentIndex() == null) { m.setCurrentIndex(0); m.setStartedAt(Instant.now()); m.setQuestionStartedAt(Instant.now()); resetEditor(m); interviews.save(m); }
        return live(id);
    }

    /** Interviewer: go to a question by position (0 .. number of questions; the last value means all are done). */
    @PostMapping("/{id}/live/step")
    public ResponseEntity<?> liveStep(@PathVariable Long id, @RequestBody StepInput in) {
        MockInterview m = mineAsInterviewer(id);
        if (m == null || m.getCurrentIndex() == null) return bad("Start the live session first.");
        int total = questionList(m).size();
        int idx = in.index() == null ? 0 : Math.max(0, Math.min(total, in.index()));
        if (m.getCurrentIndex() == null || m.getCurrentIndex() != idx) {
            m.setQuestionStartedAt(Instant.now());
            if (!MockInterview.SYSTEM_DESIGN.equals(m.getType())) {
                resetEditor(m);
            }
        }
        m.setCurrentIndex(idx);
        interviews.save(m);
        return live(id);
    }

    /** A new question starts with an empty shared editor and no output; each side then loads that question's starter code. */
    private static void resetEditor(MockInterview m) {
        m.setEditorCode("");
        m.setEditorOutput("");
        m.setEditorRev((m.getEditorRev() == null ? 0 : m.getEditorRev()) + 1);
        m.setEditorBy("");
    }

    private static final Set<String> EDITOR_LANGS = Set.of("python", "java", "cpp", "c", "javascript", "go", "rust", "csharp", "php", "ruby", "swift", "text");

    /** Both people: save what is in the shared editor. */
    @PostMapping("/{id}/live/editor")
    public ResponseEntity<?> liveEditor(@PathVariable Long id, @RequestBody EditorInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (!MockInterview.MATCHED.equals(m.getStatus())) return bad("This interview is over.");
        String code = in.code() == null ? "" : in.code();
        if (code.length() > 30000) return bad("The editor is limited to 30,000 characters.");
        String lang = in.lang() != null && EDITOR_LANGS.contains(in.lang()) ? in.lang() : (MockInterview.SYSTEM_DESIGN.equals(m.getType()) ? "text" : "python");
        if (in.output() != null) m.setEditorOutput(in.output().length() > 8000 ? in.output().substring(0, 8000) : in.output());
        m.setEditorCode(code);
        m.setEditorLang(lang);
        m.setEditorRev((m.getEditorRev() == null ? 0 : m.getEditorRev()) + 1);
        m.setEditorBy(me.getId().equals(m.getInterviewerId()) ? "interviewer" : "candidate");
        if (MockInterview.SYSTEM_DESIGN.equals(m.getType())) {
            m.setDesignNotes(code);
        }
        interviews.save(m);
        return ResponseEntity.ok(Map.of("rev", m.getEditorRev()));
    }

    /** Both people: save design notes for system design interviews. */
    @PostMapping("/{id}/live/design-notes")
    public ResponseEntity<?> saveDesignNotes(@PathVariable Long id, @RequestBody DesignNotesInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (!MockInterview.MATCHED.equals(m.getStatus())) return bad("This interview is over.");
        String notes = in.notes() == null ? "" : in.notes();
        if (notes.length() > 50000) return bad("Notes are limited to 50,000 characters.");
        m.setDesignNotes(notes);
        m.setEditorCode(notes);
        m.setEditorLang("text");
        m.setEditorRev((m.getEditorRev() == null ? 0 : m.getEditorRev()) + 1);
        m.setEditorBy(me.getId().equals(m.getInterviewerId()) ? "interviewer" : "candidate");
        interviews.save(m);
        return ResponseEntity.ok(Map.of("success", true, "rev", m.getEditorRev()));
    }

    /** Both people: upload a design diagram/image for system design interviews. */
    @PostMapping(value = "/{id}/live/design-image", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDesignImage(@PathVariable Long id, @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (!MockInterview.MATCHED.equals(m.getStatus())) return bad("This interview is over.");
        if (file == null || file.isEmpty()) return bad("No file provided");

        try {
            String imageUrl = imageService.upload(file);
            m.setDesignImageUrl(imageUrl);
            m.setDesignImageBy(me.getId().equals(m.getInterviewerId()) ? "interviewer" : "candidate");
            m.setDesignImageUploadedAt(Instant.now());
            interviews.save(m);
            return ResponseEntity.ok(Map.of("imageUrl", imageUrl));
        } catch (Exception e) {
            return bad("Failed to upload image: " + e.getMessage());
        }
    }

    /** Both people: save diagram image URL for system design interviews. */
    @PostMapping("/{id}/live/design-image-url")
    public ResponseEntity<?> saveDesignImageUrl(@PathVariable Long id, @RequestBody DesignImageUrlInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        if (!MockInterview.MATCHED.equals(m.getStatus())) return bad("This interview is over.");
        String url = in.imageUrl() == null ? "" : in.imageUrl().trim();
        if (url.isEmpty()) return bad("No image URL provided");
        m.setDesignImageUrl(url);
        m.setDesignImageBy(me.getId().equals(m.getInterviewerId()) ? "interviewer" : "candidate");
        m.setDesignImageUploadedAt(Instant.now());
        interviews.save(m);
        return ResponseEntity.ok(Map.of("imageUrl", url));
    }

    /** Both people: the state of the live session. The candidate sees the current question only, and never its answer. */
    @GetMapping("/{id}/live")
    public ResponseEntity<?> live(@PathVariable Long id) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !(me.getId().equals(m.getCandidateId()) || me.getId().equals(m.getInterviewerId()))) return ResponseEntity.notFound().build();
        boolean interviewer = me.getId().equals(m.getInterviewerId());

        // Track presence: update last seen time
        if (interviewer) {
            m.setInterviewerLastSeen(Instant.now());
        } else {
            m.setCandidateLastSeen(Instant.now());
        }
        interviews.save(m);

        // If system design, sync between editorCode and designNotes so neither is lost
        if (MockInterview.SYSTEM_DESIGN.equals(m.getType())) {
            if ((m.getEditorCode() == null || m.getEditorCode().isBlank()) && m.getDesignNotes() != null && !m.getDesignNotes().isBlank()) {
                m.setEditorCode(m.getDesignNotes());
                m.setEditorLang("text");
                interviews.save(m);
            } else if ((m.getDesignNotes() == null || m.getDesignNotes().isBlank()) && m.getEditorCode() != null && !m.getEditorCode().isBlank()) {
                m.setDesignNotes(m.getEditorCode());
                interviews.save(m);
            }
        }

        List<Map<String, Object>> qs = questionList(m);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("role", interviewer ? "interviewer" : "candidate");
        out.put("type", m.getType());
        out.put("status", m.getStatus());
        out.put("slotAt", m.getSlotAt());
        out.put("callUrl", MockInterview.MATCHED.equals(m.getStatus()) && m.getCallUrl() != null && m.getCallUrl().startsWith("https://meet.google.com/") ? m.getCallUrl() : null);
        out.put("whiteboardUrl", MockInterview.MATCHED.equals(m.getStatus()) ? m.getWhiteboardUrl() : null);
        Long otherId = interviewer ? m.getCandidateId() : m.getInterviewerId();
        out.put("partner", otherId == null ? null : users.findById(otherId).map(MockInterviewController::displayName).orElse("A member"));
        out.put("feedback", m.getFeedbackAt() == null ? null : Map.of("rating", m.getFeedbackRating(), "strengths", m.getFeedbackStrengths() == null ? "" : m.getFeedbackStrengths(),
                "improve", m.getFeedbackImprove() == null ? "" : m.getFeedbackImprove(), "at", m.getFeedbackAt().toString()));
        out.put("started", m.getCurrentIndex() != null);
        out.put("startedAt", m.getStartedAt());
        out.put("questionStartedAt", m.getQuestionStartedAt());
        out.put("serverNow", Instant.now());

        // Add presence information
        out.put("candidateLastSeen", m.getCandidateLastSeen());
        out.put("interviewerLastSeen", m.getInterviewerLastSeen());

        String defaultLang = MockInterview.SYSTEM_DESIGN.equals(m.getType()) ? "text" : "python";
        out.put("editor", Map.of("code", m.getEditorCode() == null ? "" : m.getEditorCode(), "lang", m.getEditorLang() == null ? defaultLang : m.getEditorLang(),
                "rev", m.getEditorRev() == null ? 0 : m.getEditorRev(), "by", m.getEditorBy() == null ? "" : m.getEditorBy(),
                "output", m.getEditorOutput() == null ? "" : m.getEditorOutput()));
        out.put("designNotes", m.getDesignNotes() == null ? (m.getEditorCode() == null ? "" : m.getEditorCode()) : m.getDesignNotes());
        out.put("designImage", m.getDesignImageUrl() == null ? null : Map.of(
                "url", m.getDesignImageUrl(),
                "by", m.getDesignImageBy() == null ? "" : m.getDesignImageBy(),
                "uploadedAt", m.getDesignImageUploadedAt()
        ));
        out.put("total", qs.size());
        int idx = m.getCurrentIndex() == null ? -1 : m.getCurrentIndex();
        out.put("index", idx);
        out.put("allDone", m.getCurrentIndex() != null && idx >= qs.size());
        if (idx >= 0 && idx < qs.size()) {
            Map<String, Object> q = new LinkedHashMap<>(qs.get(idx));
            boolean coding = String.valueOf(q.get("ref")).startsWith("c:");
            if (!interviewer && !coding) q.put("body", "");   // a candidate is never shown the answer to an interview question
            if (coding) {
                try { q.put("problemId", Long.parseLong(String.valueOf(q.get("ref")).substring(2))); } catch (NumberFormatException ignored) { /* no problem id */ }
            }
            q.remove("ref");
            out.put("question", q);
        }
        if (interviewer) {
            List<String> titles = new ArrayList<>();
            for (Map<String, Object> q : qs) titles.add(String.valueOf(q.get("title")));
            out.put("titles", titles);
        }
        return ResponseEntity.ok(out);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> questionList(MockInterview m) {
        try {
            return m.getQuestionsJson() == null ? new ArrayList<>() : JSON.readValue(m.getQuestionsJson(), List.class);
        } catch (Exception e) { return new ArrayList<>(); }
    }

    /** Interviewer: write feedback for the candidate (during or after the interview). The candidate is emailed. */
    @PostMapping("/{id}/feedback")
    public ResponseEntity<?> feedback(@PathVariable Long id, @RequestBody FeedbackInput in) {
        User me = me();
        MockInterview m = interviews.findById(id).orElse(null);
        if (m == null || !me.getId().equals(m.getInterviewerId())) return ResponseEntity.notFound().build();
        if (!(MockInterview.MATCHED.equals(m.getStatus()) || MockInterview.DONE.equals(m.getStatus()))) return bad("Feedback can be given for an interview that took place.");
        if (m.getCurrentIndex() == null && MockInterview.MATCHED.equals(m.getStatus())) return bad("Start the live interview before giving feedback.");
        if (in.rating() == null || in.rating() < 1 || in.rating() > 5) return bad("Give an overall rating from 1 to 5.");
        String good = in.strengths() == null ? "" : in.strengths().trim();
        String better = in.improve() == null ? "" : in.improve().trim();
        if (good.isEmpty() && better.isEmpty()) return bad("Write at least a line about what went well or what to improve.");
        if (good.length() > 3000 || better.length() > 3000) return bad("Please keep each part under 3000 characters.");
        boolean first = m.getFeedbackAt() == null;
        m.setFeedbackRating(in.rating());
        m.setFeedbackStrengths(good);
        m.setFeedbackImprove(better);
        m.setFeedbackAt(Instant.now());
        interviews.save(m);
        if (first) {
            try {
                users.findById(m.getCandidateId()).ifPresent(c -> email.sendAnnouncement(c.getEmail(), "Feedback from your mock interview",
                        "Your interviewer left feedback on your mock interview (" + in.rating() + " out of 5). Open Interview Reader, go to Interview and read it: https://interviewreader.cloud/interview"));
            } catch (Exception e) { log.warn("Could not email the feedback notice", e); }
        }
        return ResponseEntity.ok(view(m, me));
    }

    /** Hours after the start time before an interview can be marked as finished (either person). */
    private static final long FINISH_AFTER_HOURS = 1;

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> complete(@PathVariable Long id) {
        MockInterview m = interviews.findById(id).orElse(null);
        if (m != null && MockInterview.MATCHED.equals(m.getStatus())) {
            List<Map<String, Object>> qs = questionList(m);
            boolean allDone = m.getCurrentIndex() != null && m.getCurrentIndex() >= qs.size();
            Instant start = m.getSlotAt() != null ? m.getSlotAt() : m.getMatchedAt();
            boolean hourPassed = start != null && !Instant.now().isBefore(start.plusSeconds(FINISH_AFTER_HOURS * 3600));
            if (!allDone && !hourPassed)
                return bad("An interview can be marked as finished once all questions are completed or " + FINISH_AFTER_HOURS + " hour after its start time.");
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
        out.put("started", m.getCurrentIndex() != null);
        out.put("startedAt", m.getStartedAt());
        List<Map<String, Object>> qs = questionList(m);
        boolean allDone = m.getCurrentIndex() != null && m.getCurrentIndex() >= qs.size();
        out.put("allDone", allDone);
        boolean matched = MockInterview.MATCHED.equals(m.getStatus());
        // Only a link the interviewer added (Google Meet) is shown; links from the earlier auto-created rooms are ignored.
        boolean meet = m.getCallUrl() != null && m.getCallUrl().startsWith("https://meet.google.com/");
        out.put("callUrl", matched && meet ? m.getCallUrl() : null);
        out.put("whiteboardUrl", matched ? m.getWhiteboardUrl() : null);
        out.put("hasResume", m.getResumeId() != null);

        // Add presence information
        out.put("candidateLastSeen", m.getCandidateLastSeen());
        out.put("interviewerLastSeen", m.getInterviewerLastSeen());

        // Only the interviewer sees the questions (and the answers that come with them).
        out.put("feedback", m.getFeedbackAt() == null ? null : Map.of("rating", m.getFeedbackRating(), "strengths", m.getFeedbackStrengths() == null ? "" : m.getFeedbackStrengths(),
                "improve", m.getFeedbackImprove() == null ? "" : m.getFeedbackImprove(), "at", m.getFeedbackAt().toString()));
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
            // Resume interviews have no predefined questions - the interviewer discusses the resume itself
            if (MockInterview.RESUME.equals(m.getType())) {
                return "[]";
            }

            if (MockInterview.CODING.equals(m.getType())) {
                List<Long> ids = new ArrayList<>();
                codingProblems.findSummariesByOrderByIdAsc().forEach(p -> ids.add(p.getId()));
                Collections.shuffle(ids, RNG);
                for (Long id : ids.subList(0, Math.min(3, ids.size()))) {
                    CodingProblem p = codingProblems.findById(id).orElse(null);
                    if (p != null) picked.add(Map.of("ref", "c:" + p.getId(), "title", p.getTitle() + " (" + p.getDifficulty() + ")", "body", p.getStatement()));
                }
            } else if (MockInterview.SYSTEM_DESIGN.equals(m.getType())) {
                // System design interviews get questions from both HLD (starting with "Design") and LLD
                List<Question> hldQuestions = questions.findByTech("hld");
                // Filter HLD questions to only those starting with "Design"
                List<Question> filteredHld = hldQuestions.stream()
                        .filter(question -> {
                            String title = question.getQuestion() == null ? question.getTitle() : question.getQuestion();
                            return title != null && title.toLowerCase().startsWith("design");
                        })
                        .toList();
                List<Question> lldQuestions = questions.findByTech("lld");
                List<Question> allDesignQuestions = new ArrayList<>();
                allDesignQuestions.addAll(filteredHld);
                allDesignQuestions.addAll(lldQuestions);

                Collections.shuffle(allDesignQuestions, RNG);
                for (Question q : allDesignQuestions.subList(0, Math.min(3, allDesignQuestions.size()))) {
                    String prefix = filteredHld.contains(q) ? "[HLD] " : "[LLD] ";
                    picked.add(Map.of("ref", "q:" + q.getId(),
                                     "title", prefix + (q.getQuestion() == null ? q.getTitle() : q.getQuestion()),
                                     "body", q.getAnswer() == null ? "" : q.getAnswer()));
                }
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
